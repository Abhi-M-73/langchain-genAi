import pypandoc

content = r"""# Terminal AI Chatbot with Node.js, LangChain & Groq

A step-by-step learning project for a terminal-based AI chatbot using Node.js `readline`, LangChain, Groq, and a custom JavaScript multiplication tool.

> **Status:** Basic chat, terminal commands, tool calling, and conversation history have been explored. History trimming still needs a tool-safe improvement before production use.

## Features

- Terminal input with Node.js `readline`
- Groq chat model through LangChain
- Conversation history for the current session
- `help`, `clear`, and `exit` commands
- Custom `multiply_numbers` tool using Zod validation
- AI tool-call → JavaScript execution → `ToolMessage` result → AI final response flow
- Recent-message window to reduce the amount of history sent to the model

## Tech stack

Node.js, JavaScript ES modules, `@langchain/groq`, `@langchain/core`, `langchain`, `dotenv`, `groq-sdk`, and `zod`.

## 1. Project setup

```bash
mkdir terminal-ai-chatbot
cd terminal-ai-chatbot
npm init -y
npm install @langchain/groq @langchain/core langchain dotenv groq-sdk zod
```

Set `"type": "module"` in `package.json` so the project can use `import` and `export`.

Example structure:

```text
terminal-ai-chatbot/
├── .env
├── .gitignore
├── model.js
├── tools.js
├── server.js
├── package.json
└── README.md
```

## 2. Environment variables

Create `.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Create `.gitignore`:

```gitignore
node_modules/
.env
```

**Never commit a real API key to GitHub.** If a key was accidentally published, revoke it and generate a new one.

## 3. Configure the model (`model.js`)

```javascript
import { config } from "dotenv";
import { ChatGroq } from "@langchain/groq";

config();

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
});

export default model;
```

Model IDs can change over time. If Groq reports that this model is unavailable, check its current model list and update the ID.

## 4. Create the multiplication tool (`tools.js`)

```javascript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const operation1 = async ({ a, b }) => {
  return a * b;
};

const operation1Details = {
  name: "multiply_numbers",
  description: "Multiply two numbers together.",
  schema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
};

const multiplyNumbers = tool(operation1, operation1Details);

export default multiplyNumbers;
```

- `operation1` performs the multiplication.
- `name` identifies the tool.
- `description` helps the model decide when to use it.
- `z.object(...)` defines and validates the tool arguments.
- `tool(...)` wraps the JavaScript function as a LangChain tool.

## 5. Terminal chatbot (`server.js`)

```javascript
import readline from "node:readline";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import model from "./model.js";
import multiplyNumbers from "./tools.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const systemPrompt = new SystemMessage(
  "You are a friendly coding teacher. You are expert in JavaScript and MERN. " +
  "Don't add comments into response. " +
  "Give me exact answer simple and short. " +
  "Explain programming concepts in simple English."
);

const messages = [systemPrompt];
const modelWithTools = model.bindTools([multiplyNumbers]);

const executeToolCalls = async (response, messages) => {
  messages.push(response);

  for (const toolCall of response.tool_calls) {
    if (toolCall.name === "multiply_numbers") {
      const result = await multiplyNumbers.invoke(toolCall.args);

      messages.push(
        new ToolMessage({
          tool_call_id: toolCall.id,
          content: String(result),
        })
      );
    }
  }
};

const askQuestion = () => {
  rl.question("\nYou: ", async (ans) => {
    const input = ans?.trim().toLowerCase();

    if (input === "") {
      console.log("Please type anything");
      askQuestion();
      return;
    }

    if (input === "exit") {
      console.log("Chatbot closed!");
      rl.close();
      return;
    }

    if (input === "clear") {
      messages.length = 1;
      console.log("History cleared!");
      askQuestion();
      return;
    }

    if (input === "help") {
      console.log(`Available Commands:
help  - Show all commands
clear - Clear chat history
exit  - Close chatbot
`);
      askQuestion();
      return;
    }

    const previousLength = messages.length;
    messages.push(new HumanMessage(input));

    try {
      const getRecentMessages = () => [
        messages[0],
        ...messages.slice(1).slice(-10),
      ];

      let response = await modelWithTools.invoke(getRecentMessages());

      while (response.tool_calls?.length) {
        await executeToolCalls(response, messages);
        response = await modelWithTools.invoke(getRecentMessages());
      }

      messages.push(response);
      console.log("AI_Reply:", response.content);
    } catch (error) {
      messages.length = previousLength;
      console.error("Error:", error.message);
    }

    askQuestion();
  });
};

askQuestion();
```

## 6. How tool calling works

1. The user asks something like `25 multiply by 4`.
2. `modelWithTools.invoke(...)` sends the conversation and tool definition to the model.
3. The model may return a tool request in `response.tool_calls`.
4. `executeToolCalls(...)` runs the requested JavaScript tool.
5. The result is added as a `ToolMessage` with the matching `tool_call_id`.
6. The model is called again with the tool result.
7. The final AI response is printed in the terminal.

The model does not execute JavaScript itself. The app receives the tool request and runs the function.

## 7. Conversation history

`messages` stores the system prompt and current-session messages:

```javascript
const messages = [systemPrompt];
```

The `clear` command resets the array while preserving the system prompt:

```javascript
messages.length = 1;
```

To reduce the history sent to the model, the current learning version uses:

```javascript
const getRecentMessages = () => [
  messages[0],
  ...messages.slice(1).slice(-10),
];
```

This sends the system prompt plus up to the last 10 other messages. It reduces the number of messages sent, but does not guarantee a fixed token count because message lengths vary.

**Important limitation:** simple `slice(-10)` history trimming is not fully tool-safe. It may separate an AI tool-call message from its matching `ToolMessage`. In a robust version, trim complete conversation turns and preserve tool-call/result pairs. Also consider a maximum tool-call loop count.

## 8. Run the chatbot

```bash
node server.js
```

Try:

```text
Hello, how are you?
25 multiply by 4
12 multiply by 8
help
clear
exit
```

Expected multiplication results: `25 × 4 = 100`, and `12 × 8 = 96`. The AI's wording may vary.

## 9. Next improvements

- Make history trimming preserve complete turns and tool-call/result pairs.
- Add a maximum tool-call iteration limit.
- Add more tools, such as addition or subtraction.
- Improve input validation and error messages.
- Add tests for tool execution and history handling.
- Keep API credentials out of GitHub and check model availability when needed.

---

Built while learning Node.js, LangChain, Groq, and AI tool calling step by step.
"""

