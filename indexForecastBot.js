//Loads environment variables from .env file
require("dotenv").load();

//Defines constant data for Discord
const Discord = require("discord.js");
const express = require("express");
const request = require("request");
const client = new Discord.Client();

