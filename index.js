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

//The channel in which the bot will reside
var walkingChannel = client.channels.get(process.env.WalkingChannelID.toString());

//Schedules certain actions to be taken at certain times
var now = new Date();
setTimeout(function() {
    https.get("http://api.openweathermap.org/data/2.5/weather?q=Boulder,us&appid=" + process.env.OpenWeatherKey.toString(), (response) => {
        let data = '';
        response.on('data', (chunk) => {
            data += chunk;
        });
        response.on('end', () => {
            var weatherInfo = JSON.parse(data);
            walkingChannel.send("Good morning everyone! For " + now.toLocaleDateString() + ", the temperature is " + weatherInfo.main.temp + "K with a humidity of " + weatherInfo.main.humidity + "%. With wind speeds of " + weatherInfo.wind.speed + "m/s. The weather can be summed up by " + weatherInfo.weather.description + "!");
        });
    });
    now = new Date();
    setTimeout(function() {
        var msg = walkingChannel.send("Yo neighbors! Give this message a 👍 if you are walking, or a 👎 if you aren't. No response is taken as not walking!")
        setTimeout(() => {
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
    }, 200);
}, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 15, 0, 0)); //Above happens at 6:15 every day
