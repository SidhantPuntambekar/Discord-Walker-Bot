const https = require('https');
const Discord = require('discord.js');
const client = new Discord.Client();

//If environment variables aren't already available, load them from file
if (process.env.DiscordKey == undefined) {
    require('dotenv').load()
}

client.login(process.env.DiscordKey.toString());

//The persons whomst shall walkst amongst the enemies before school
var neighbors = {
    'Lord Strainer#0454': 'Saurabh',
    'IIPerson#1723': 'Elia',
    'Kxoe#8732': 'Kadin',
    'wussupnik#6607': 'Nikaash'
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    //The channel that the bot will send messages in
    var walkingChannel = client.channels.array().filter(function (channel) {
        return channel.id == process.env.WalkingChannelID;
    })[0];

    //Schedules certain actions to be taken at certain times
    var now = new Date();
    client.setTimeout(function () {
        https.get("https://api.openweathermap.org/data/2.5/weather?q=Boulder,us&appid=" + process.env.OpenWeatherKey.toString(), (response) => {
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                var weatherInfo = JSON.parse(data);
                walkingChannel.send("Good morning everyone! For " + now.toLocaleDateString() + ", the temperature is " + weatherInfo.main.temp + "K with a humidity of " + weatherInfo.main.humidity + "%. Wind speeds currently are " + weatherInfo.wind.speed + "m/s. The weather can be summed up by " + weatherInfo.weather.description + "!");
            });
        });
        now = new Date();
        client.setTimeout(function () {
            walkingChannel.send("Yo neighbors! Give this message a 👍 if you are walking, or a 👎 if you aren't. No response is taken as not walking!").then (function (msg) {
                client.setTimeout(() => {
                    var reactions = msg.reactions.array();
                    var walkers = [];
                    var losers = [];
                    for (var i = 0; i < reactions.length; i++) {
                        var reaction = reactions[i];
                        if (reaction.emoji.toString() == "👍") {
                            walkers = reaction.users.array().map((user) => user.username);
                        } else if (reaction.emoji.toString() == "👎") {
                            losers = reaction.users.array().map((user) => user.username);
                        }
                    }
                    walkingChannel.send("The cool neighbors today are " + walkers.slice(0, -2).join(', ') + (walkers.slice(0, -2).length ? ', ' : '') + walkers.slice(-2).join(', and ') + ".");
                }, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 15, 0, 0)); //Above happens at 8:15 every day
            });
        }, 200);
    }, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 15, 0, 0)); //Above happens at 6:15 every day

});

