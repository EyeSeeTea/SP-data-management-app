import { Config } from "../Config";
import configJson from "./config.json";

const config = (configJson as unknown) as Config;
export default config;
