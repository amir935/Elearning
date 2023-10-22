import { connect } from "http2";
import { app } from "./app";
import connectDB from "./utils/db";

import {v2 as cloudinay} from "cloudinary";

require("dotenv").config();


//cloudinary config

cloudinay.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret : process.env.CLOUD_SECRET_KEY,
});

//create server

app.listen(process.env.PORT, () => {
  console.log(`server is connected with port ${process.env.PORT}`);
  connectDB();
});
