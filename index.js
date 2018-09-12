"use strict";

//Loads environment variables from .env; won't overwrite existing variables
require("dotenv").load();

const Discord = require("discord.js");
const express = require("express");
const request = require("request");
const client = new Discord.Client();

//Binds the app to the heroku port
express().listen(process.env.PORT);

//A dictionary of discord tags to names for the neighbors that will be walking
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
    if (array.length === 0) {
        return "";
    }
    if (array.length === 1) {
        return `${array[0]}`;
    }
    if (array.length === 2) {
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
function now() { return new Date(); }

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
    client.destroy();
    process.exit(0);
}

//Leaves if the bot is outside of active hours
if (!shouldBeActive()) {
    exit();
}

//Timer will ping application every 15 minutes until bot has finished its execution
let herokuTimer = setInterval(() => {
    if (!shouldBeActive()) {
        clearInterval(herokuTimer);
        setTimeout(exit, 5 * 60 * 1000); //Bot will wait 5 minutes before shutting down
    } else {
        request("https://stormy-walker.herokuapp.com");
    }
}, 15 * 60 * 1000);

/**
 * A function to get the weather data
 * Returns a promise that resolves to the weather data
 */
function getWeatherData() {
    return new Promise(resolve => {
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
    return `Good morning everyone! For ${now().toLocaleDateString("en-US", dateFormat)}, the temperature is ${weatherInfo.main.temp}K with a humidity of ${weatherInfo.main.humidity}%. Wind speeds currently are ${weatherInfo.wind.speed}m/s. The weather can be summed up by ${formatArrayToString(weatherInfo.weather.map(weather => weather.description))}!`
}

//Schedules the bot to read the weather and ask for walkers in the morning at the query time
client.setTimeout(async () => {

    //Waits for the bot to log in
    await client.login(process.env.DiscordKey);

    //Gets the channel that the bot will send messages in
    let walkingChannel = client.channels.array().find(channel => channel.id === process.env.WalkingChannelID);

    //Tries to set the icon of the bot to an icon of the current weather
    try {
        await client.user.setAvatar(`http://openweathermap.org/img/w/${(await getWeatherData()).weather[0].icon}.png`);
    } catch (e) {}
    //Bot sends the initial message querying who will be walking and containing weather data
    let queryMessage = await walkingChannel.send(await getMessageToSend());
    await queryMessage.pin();
    //Bot reacts to its own message with the necessary emoji for ease of neighbor use
    let reaction = await queryMessage.react(affirmationEmoji);

    //Bot periodically updates queryMessage updated weather information and reaction information; updates every 15 seconds
    let queryMessageUpdater = client.setInterval(async () => {
        let walkerNames = reaction.users.array().filter(user => "tag" in user && user.tag in neighbors).map(user => neighbors[user.tag]);
        let currentWalkersMessage = "";
        if (walkerNames.length > 1) {
            currentWalkersMessage = `So far, ${formatArrayToString(walkerNames)} have said they will be cool today. 😎`;
        } else if (walkerNames.length === 1) {
            currentWalkersMessage = `${walkerNames[0]} is the only cool person so far.`;
        } else {
            currentWalkersMessage = "None of the neighbors have said they will walk yet... 😢";
        }
        await queryMessage.edit(`${await getMessageToSend()} For those who are walking, please react to this message with a ${affirmationEmoji}; other emojis or lack thereof are ignored.\n${currentWalkersMessage}`);
    }, 15 * 1000);

    //At displayTime, bot updates message one final time
    client.setTimeout(async () => {
        client.clearInterval(queryMessageUpdater);
        await queryMessage.unpin();
        let walkers = reaction.users.array().filter(user => "tag" in user && user.tag in neighbors).map(walker => walker.tag);
        let finalMessage = "";
        if (walkers.length === 0) {
            finalMessage = "Nobody walked... 😢";
        } else if (walkers.length === 1) {
            finalMessage = `${neighbors[walkers[0]]} is the only lonely but cool walker.`;
        } else {
            finalMessage = `${formatArrayToString(walkers.map(tag => neighbors[tag]))} are pretty cool. 😎`;
        }
        await queryMessage.edit(`${await getMessageToSend()}\n${finalMessage}`);
        exit();
    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), displayTime.hour, displayTime.minute, 0, 0) - now());

}, new Date(now().getFullYear(), now().getMonth(), now().getDate(), queryTime.hour, queryTime.minute, 0, 0) - now());