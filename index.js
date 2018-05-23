const https = require('https');
const Discord = require('discord.js');
const client = new Discord.Client();

//If environment variables aren't already available, load them from file
if (process.env.DiscordKey == undefined) {
    require('dotenv').load()
}

//Logs the bot in
client.login(process.env.DiscordKey.toString());

//A list of tags of neighbors who walk and will have data collected on them
var neighbors = ['Lord Strainer#0454', 'IIPerson#1723', 'Kxoe#8732', 'wussupnik#6607'];
//What emoji will be used for affirmation of walking
var affirmationEmoji = "👍";

//The times at which the bot will be active
var queryTime = { hour: 6, minute: 15 };
var displayTime = { hour: 8, minute: 15 };

/**
 * Formats an array to an appropriate string
 */
function formatArrayToString(array) {
    if (array.length == 0) {
        return "";
    }
    if (array.length == 1) {
        return array[0].toString();
    }
    if (array.length == 2) {
        return array[0].toString() + " and " + array[1].toString();
    }
    return array.slice(0, -2).join(', ') + (array.slice(0, -2).length ? ', ' : '') + array.slice(-2).join(', and ');
}

/**
 * Main entry point for the program; what happens when the bot logs in
 * All bot actions need to be taken in this body
 */
client.on('ready', () => {

    //Gets the channel that the bot will send messages in
    var walkingChannel = client.channels.array().filter((channel) => {
        return channel.id == process.env.WalkingChannelID;
    })[0];

    //A function that gets the current date and time
    function now() { return new Date(); };

    //On weekends (0 is sunday, 6 is saturday), the bot doesn't do anything
    if (now().getDay() % 6 === 0) {
        return;
    }

    //Schedules the bot to read the weather and ask for walkers in the morning at the query time
    setTimeout(() => {
        //Gets the weather from the OpenWeatherMap API
        https.get("https://api.openweathermap.org/data/2.5/weather?q=Boulder,us&appid=" + process.env.OpenWeatherKey.toString(), (response) => {
            //API response gets accumulated into data
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            //After response has been fully collected, the response gets parsed and the rest of the program continues
            response.on('end', () => {
                var weatherInfo = JSON.parse(data);
                var dateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                //Sends a message on the walking channel with the weather data and asks for who is walking
                walkingChannel.send("Good morning everyone! For " + now().toLocaleDateString("en-US", dateFormat) + ", the temperature is " + weatherInfo.main.temp + "K with a humidity of " + weatherInfo.main.humidity + "%. Wind speeds currently are " + weatherInfo.wind.speed + "m/s. The weather can be summed up by " + weatherInfo.weather[0].description + "! For those who are walking, please react to this message with a '" + affirmationEmoji + "': other emojis or lack thereof are ignored.").then((msg) => {
                    //At displayTime, bot reads the original message's reactions and displays who is walking; also updates stats for each neighbor
                    setTimeout(() => {
                        var reactions = msg.reactions.array();
                        var walkers = [];
                        for (var i = 0; i < reactions.length; i++) {
                            var reaction = reactions[i];
                            if (reaction.emoji.toString() == affirmationEmoji) {
                                walkers = reaction.users.array().filter((user) => neighbors.indexOf(user.tag) > -1).map((user) => user.username);
                            }
                        }
                        if (walkers.length > 0) {
                            walkingChannel.send("The cool neighbors today are " + formatArrayToString(walkers) + ".");
                        } else {
                            walkingChannel.send("No one is walking today... :(");
                        }
                        //TODO: collect statistics on who is walking
                    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), displayTime.hour, displayTime.minute, 0, 0) - now());
                });
            });
        });
    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), queryTime.hour, queryTime.minute, 0, 0) - now());

});
