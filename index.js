const request = require("request");
const Discord = require("discord.js");
const pg = require("pg");
const client = new Discord.Client();

//The client for the database; left uninitialized unless is on Heroku
var databaseClient;

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
let tentativeConfirmTime = { hour: 13, minute: 30 };
let displayTime = { hour: 14, minute: 15 };

//A function that gets the current date and time in UTC
function now() { return new Date(); };

/**
 * A function that returns whether the bot should be active right now
 * Days 0 and 6 are weekends, so the bot shouldn't be active then
 */
function shouldBeActive() {
    return now().getDay() % 6 !== 0 && now() <= new Date(now().getFullYear(), now().getMonth(), now().getDate(), displayTime.hour, displayTime.minute, 0, 0);
}

//If environment variables aren't already available, load them from file
if (process.env.PORT == undefined) {
    require("dotenv").load()
} else { //If environment variables are already available, then Heroku is being used; below will keep Heroku app awake
    //Binds the app to the heroku port
    let express = require('express');
    express().listen(process.env.PORT);
    //Initializes and connects the database client
    databaseClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    (async () => await databaseClient.connect())();
    //Timer will ping application every 5 minutes until bot has finished its execution
    let herokuTimer = setInterval(() => {
        if (!shouldBeActive()) {
            clearInterval(herokuTimer);
            process.exit(0);
        } else {
            request("https://stormy-walker.herokuapp.com");
        }
    }, 5 * 60 * 1000);
}

//If the bot shouldn't be running, leave
if (!shouldBeActive()) {
    process.exit(0);
}

//Logs the bot in
client.login(`${process.env.DiscordKey}`);

/**
 * Main entry point for the program; what happens when the bot logs in
 * All bot actions need to be taken in this body
 */
client.on("ready", () => {

    //Gets the channel that the bot will send messages in
    let walkingChannel = client.channels.array().find(channel => channel.id == process.env.WalkingChannelID);

    //Schedules the bot to read the weather and ask for walkers in the morning at the query time
    client.setTimeout(() => {
        //Gets the weather from the OpenWeatherMap API
        request(`https://api.openweathermap.org/data/2.5/weather?q=Boulder,us&appid=${process.env.OpenWeatherKey}`, async (error, response, body) => {
            let weatherInfo = JSON.parse(body);
            let dateFormat = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
            //Sets the icon of the bot to an icon of the current weather
            client.user.setAvatar(`http://openweathermap.org/img/w/${weatherInfo.weather[0].icon}.png`);
            //Sends a message on the walking channel with the weather data and asks for who is walking
            let queryMessage = await walkingChannel.send(`Good morning everyone! For ${now().toLocaleDateString("en-US", dateFormat)}, the temperature is ${weatherInfo.main.temp}K with a humidity of ${weatherInfo.main.humidity}%. Wind speeds currently are ${weatherInfo.wind.speed}m/s. The weather can be summed up by ${formatArrayToString(weatherInfo.weather.map(weather => weather.description))}! For those who are walking, please react to this message with a ${affirmationEmoji}; other emojis or lack thereof are ignored.`);
            //Bot reacts to its own message with the necessary emoji for ease of neighbor use
            let reaction = await queryMessage.react(affirmationEmoji);
            //Sends out a message of who so far has tentatively said they would be walking
            client.setTimeout(() => {
                let walkers = reaction.users.array().filter(user => "tag" in user && user.tag in neighbors);
                let cancelWarning = "It still isn't too late to confirm! You may still react to the previous message to signal that you will walk. You may also remove your reaction if you actually will not be walking.";
                if (walkers.length > 1) {
                    walkingChannel.send(`So far, ${formatArrayToString(walkers.map(user => neighbors[user.tag]))} have confirmed that they are walking. ${cancelWarning}`);
                } else if (walkers.length == 1) {
                    walkingChannel.send(`${neighbors[walkers[0].tag]} has confirmed they are walking. Don't leave them to walk alone! ${cancelWarning}`);
                } else {
                    walkingChannel.send(`No one has said they will walk today... 🙁 ${cancelWarning}`);
                }
            }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), tentativeConfirmTime.hour, tentativeConfirmTime.minute, 0, 0) - now());
            //At displayTime, bot reads the original message's reactions and displays who is walking; also updates stats for each neighbor
            client.setTimeout(() => {
                let walkers = reaction.users.array().filter(user => "tag" in user && user.tag in neighbors);
                if (walkers.length > 1) {
                    walkingChannel.send(`The cool neighbors today are ${formatArrayToString(walkers.map(user => neighbors[user.tag]))}.`);
                } else if (walkers.length == 1) {
                    walkingChannel.send(`${neighbors[walkers[0].tag]} is a very cool neighbor.`);
                } else {
                    walkingChannel.send("No one is walking today... 🙁");
                }
                //Adds the walking information to the database if database is available
                if (databaseClient == undefined) {
                    return;
                }
                walkers.forEach(async walker => {
                    let walkerId = (await databaseClient.query("SELECT id FROM neighbors WHERE discord_tag = $1;", [walker.tag])).rows[0]["id"];
                    await databaseClient.query("INSERT INTO walking_dates(walker_id, walking_date) VALUES($1, CURRENT_DATE);", [walkerId]);
                });
            }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), displayTime.hour, displayTime.minute, 0, 0) - now());
        });
    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), queryTime.hour, queryTime.minute, 0, 0) - now());

});
