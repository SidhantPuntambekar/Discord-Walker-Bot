const https = require('https');
const Discord = require('discord.js');
const client = new Discord.Client();

//If environment variables aren't already available, load them from file
if (process.env.DiscordKey == undefined) {
    require('dotenv').load()
}

//Logs the bot in
client.login(process.env.DiscordKey.toString());

//The persons whomst shall walkst amongst the enemies before school
var neighbors = ['Lord Strainer#0454', 'IIPerson#1723', 'Kxoe#8732', 'wussupnik#6607'];

/**
 * Main entry point for the program; what happens when the bot logs in
 * All bot actions need to be taken in this body
 */
client.on('ready', () => {

    //Gets the channel that the bot will send messages in
    var walkingChannel = client.channels.array().filter(function (channel) {
        return channel.id == process.env.WalkingChannelID;
    })[0];

    //A function that gets the current date and time
    function now() { return new Date(); };

    //On weekends (0 is sunday, 6 is saturday), the bot doesn't do anything
    if (now().getDay() % 6 === 0) {
        return;
    }

    //Schedules the bot to read the weather and ask for walkers in the morning
    setTimeout(function () {
        //Gets and then displays the weather from OpenWeatherMap
        https.get("https://api.openweathermap.org/data/2.5/weather?q=Boulder,us&appid=" + process.env.OpenWeatherKey.toString(), (response) => {
            let data = '';
            response.on('data', function(chunk) {
                data += chunk;
            });
            response.on('end', function() {
                var weatherInfo = JSON.parse(data);
                var dateFormat = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                walkingChannel.send("Good morning everyone! For " + now().toLocaleDateString("en-US", dateFormat) + ", the temperature is " + weatherInfo.main.temp + "K with a humidity of " + weatherInfo.main.humidity + "%. Wind speeds currently are " + weatherInfo.wind.speed + "m/s. The weather can be summed up by " + weatherInfo.weather[0].description + "! Make sure to give this message a 👍 if you are walking, or a 👎 if you aren't. No response is taken as not walking!").then(function (msg) {
                    //After a while, the bot counts who is walking and gets statistics and then displays them
                    setTimeout(function() {
                        var reactions = msg.reactions.array();
                        var walkers = [];
                        var losers = [];
                        for (var i = 0; i < reactions.length; i++) {
                            var reaction = reactions[i];
                            if (reaction.emoji.toString() == "👍") {
                                walkers = reaction.users.array().filter((user) => neighbors.indexOf(user.tag) > -1).map((user) => user.username);
                            }
                        }
                        walkingChannel.send("The cool neighbors today are " + walkers.slice(0, -2).join(', ') + (walkers.slice(0, -2).length ? ', ' : '') + walkers.slice(-2).join(', and ') + ".");
                    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), 8, 15, 0, 0)); //Above happens at 8:15 every day
                });
            });
        });
    }, new Date(now().getFullYear(), now().getMonth(), now().getDate(), 6, 15, 0, 0)); //Above happens at 6:15 every day

});

