"use strict";

//Loads environment variables from .env; won't overwrite existing variables
require("dotenv").load()

const Discord = require("discord.js");
const express = require("express");
const pg = require("pg");
const request = require("request");
const client = new Discord.Client();

//Binds the app to the heroku port
express().listen(process.env.PORT);

//Initializes and connects the database client
let databaseClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
(async () => await databaseClient.connect())();

//A dictionary of discord tags to names for the neighbors that will be walkinga nd have data collected on them
let neighbors = {
    "Lord Strainer#0454": "Saurabh",
    "IIPerson#1723": "Elia",
    "Kxoe#8732": "Kadin",
    "wussupnik#6607": "Nikaash"
};

/**
 * Formats an array to an appropriate string
 */
function formatArrayToString(array) {
    if (array.length == 0) {
        return "";
    }
    if (array.length == 1) {
        return `${array[0]}`;
    }
    if (array.length == 2) {
        return `${array[0]} and ${array[1]}`;
    }
    return array.slice(0, -2).join(", ") + (array.slice(0, -2).length ? ", " : "") + array.slice(-2).join(", and ");
}

//What emoji will be used for affirmation of walking
let affirmationEmoji = "👍";

//The times at which the bot will be active in UTC
let queryTime = { hour: 12, minute: 15 };
let displayTime = { hour: 14, minute: 15 };

//The format to display dates
let dateFormat = { weekday: "long", year: "numeric", month: "long", day: "numeric" };

//A function that gets the current date and time in UTC
function now() { return new Date(); };

/**
 * A function that returns whether the bot should be active right now
 * Days 0 and 6 are weekends, so the bot shouldn't be active then
 */
function shouldBeActive() {
    return now().getDay() % 6 !== 0 && now() <= new Date(now().getFullYear(), now().getMonth(), now().getDate(), displayTime.hour, displayTime.minute, 0, 0);
}

/**
 * The exit procedure for the app
 */
function exit() {
    console.log("Leaving.");
    client.destroy();
    databaseClient.end();
    process.exit(0);
}

//Leaves if the bot is outside of active hours
if (!shouldBeActive()) {
    exit();
}

//Timer will ping application every 5 minutes until bot has finished its execution
let herokuTimer = setInterval(() => {
    if (!shouldBeActive()) {
        clearInterval(herokuTimer);
        exit();
    } else {
        request("https://stormy-walker.herokuapp.com");
    }
}, 5 * 60 * 1000);

//Logs the bot in
client.login(process.env.DiscordKey);
console.log("Starting.");

/**
 * Main entry point for the program; what happens when the bot logs in
 * All bot actions need to be taken in this body
 */
client.on("ready", () => {

    console.log("Up.");

    //Gets the channel that the bot will send messages in
    let walkingChannel = client.channels.array().find(channel => channel.id == process.env.WalkingChannelID);

    /**
     * A function to get the weather data
     * Returns a promise that resolves to the weather data
     */
    function getWeatherData() {
        return new Promise((resolve, reject) => {
            request(`https://api.openweathermap.org/data/2.5/weather?q=Boulder,us&appid=${process.env.OpenWeatherKey}`, (error, response, body) => {
                resolve(JSON.parse(body));
            });
        });
    }

    /**
     * A function that generates a message for the bot to send
     */
    async function getMessageToSend() {
        let weatherInfo = await getWeatherData();
        return `Good morning everyone! For ${now().toLocaleDateString("en-US", dateFormat)}, the temperature is ${weatherInfo.main.temp}K with a humidity of ${weatherInfo.main.humidity}%. Wind speeds currently are ${weatherInfo.wind.speed}m/s. The weather can be summed up by ${formatArrayToString(weatherInfo.weather.map(weather => weather.description))}! For those who are walking, please react to this message with a ${affirmationEmoji}; other emojis or lack thereof are ignored.`
    }

    //Schedules the bot to read the weather and ask for walkers in the morning at the query time
    client.setTimeout(async () => {

        console.log("Running.");

        //Sets the icon of the bot to an icon of the current weather
        client.user.setAvatar(`http://openweathermap.org/img/w/${(await getWeatherData()).weather[0].icon}.png`);
        //Bot sends the initial message querying who will be walking and containing weather data
        let queryMessage = await walkingChannel.send(await getMessageToSend());
        queryMessage.pin();
        //Bot reacts to its own message with the necessary emoji for ease of neighbor use
        let reaction = await queryMessage.react(affirmationEmoji);

        //Bot periodically updates queryMessage updated weather information and reaction information; updates every 15 seconds
        let queryMessageUpdater = client.setInterval(async () => {
            let walkerNames = reaction.users.array().filter(user => "tag" in user && user.tag in neighbors).map(user => neighbors[user.tag]);
            let currentWalkersMessage = "";
            if (walkerNames.length > 1) {
                currentWalkersMessage = `So far, ${formatArrayToString(walkerNames)} have said they will be cool today. 😎`;
            } else if (walkerNames.length == 1) {
                currentWalkersMessage = `${walkerNames[0]} is the only cool person so far.`;
            } else {
                currentWalkersMessage = "None of the neighbors have said they will walk yet... 😢";
            }
            queryMessage.edit(`${await getMessageToSend()}\n${currentWalkersMessage}`);
        }, 15 * 1000);

        //At displayTime, bot puts walking information in database and stops updating the previous message
        client.setTimeout(() => {
            console.log("Done");
            client.clearInterval(queryMessageUpdater);
            queryMessage.unpin();
            reaction.users.array().filter(user => "tag" in user && user.tag in neighbors).forEach(async walker => {
                let walkerId = (await databaseClient.query("SELECT id FROM neighbors WHERE discord_tag = $1;", [walker.tag])).rows[0]["id"];
                await databaseClient.query("INSERT INTO walking_dates(walker_id, walking_date) VALUES($1, CURRENT_DATE);", [walkerId]);
            });
            exit();
        }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), displayTime.hour, displayTime.minute, 0, 0) - now());

    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), queryTime.hour, queryTime.minute, 0, 0) - now());

});
