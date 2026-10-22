import { config } from "dotenv";
import { ChatGroq } from "@langchain/groq";

config();

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.7,
});

export default model;
