import pypandoc

content = r"""# Terminal AI Chatbot with Node.js, LangChain & Groq

A step-by-step learning project for building a terminal-based AI chatbot using Node.js, LangChain, Groq, and a custom JavaScript tool.

> **Project status:** Basic terminal chat, command handling, conversation history, and a multiplication tool have been implemented. History trimming still needs a tool-safe improvement before treating it as production-ready.

## Table of Contents

1. [What this project does](#what-this-project-does)
2. [Tech stack](#tech-stack)
3. [Project setup](#project-setup)
4. [Environment variables](#environment-variables)
5. [Configure the AI model](#configure-the-ai-model)
6. [Create the multiplication tool](#create-the-multiplication-tool)
7. [Create the terminal chatbot](#create-the-terminal-chatbot)
8. [How tool calling works](#how-tool-calling-works)
9. [Conversation history](#conversation-history)
10. [Run the chatbot](#run-the-chatbot)
11. [Test prompts](#test-prompts)
12. [Important notes and next steps](#important-notes-and-next-steps)

## What this project does

- Reads user input in the terminal using Node.js `readline`.
- Sends messages to a Groq-hosted language model through LangChain.
- Keeps a conversation history during the current session.
- Supports terminal commands:
  - `help` — show available commands.
  - `clear` — clear conversation history while preserving the system prompt.
  - `exit` — close the chatbot.
- Defines a custom `multiply_numbers` tool.
- Lets the AI request the multiplication tool, runs it in JavaScript, and sends the result back to the AI for a final response.

## Tech stack

- Node.js
- JavaScript ES modules
- `node:readline`
- LangChain
- `@langchain/groq`
- `@langchain/core`
- Groq API
- `dotenv`
- `zod`

## Project setup

Create a project directory and initialize npm:

```bash
mkdir terminal-ai-chatbot
cd terminal-ai-chatbot
npm init -y
```

Set the project to use ES modules by adding this field to `package.json`:

```json
{
  "type": "module"
}
```

Install the packages used in this project:

```bash
npm install @langchain/groq @langchain/core langchain dotenv groq-sdk zod
```

Example file structure:

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

## Environment variables

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

**Security:** Never commit your real API key to GitHub. Add `.env` to `.gitignore`:

```gitignore
node_modules/
.env
```

If a real API key has ever been committed publicly, revoke it and generate a new one.

## Configure the AI model

Create `model.js`:

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

The model ID available from Groq can change over time. If the provider reports that the model is unavailable, check Groq's current model list and update the ID.

## Create the multiplication tool

Create `tools.js`:

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

### What this file does

- `operation1` performs the actual multiplication.
- `name` gives the tool a unique name that the model can request.
- `description` tells the model when the tool is useful.
- `z.object(...)` validates the tool's input structure.
- `tool(...)` wraps the JavaScript function as a LangChain tool.

## Create the terminal chatbot

Create `server.js`:

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

### Important note about the history code

The code above documents the current learning approach, but the simple `slice(-10)` strategy is **not fully tool-safe**. It can cut off an AI tool-call message while leaving its `ToolMessage` (or the reverse) outside the request window. That can cause a malformed conversation or provider error.

The `executeToolCalls` helper also currently handles only `multiply_numbers`. If another tool is added, the handler must be extended or made generic.

Treat this as a learning version. Before production use, implement history trimming that preserves complete turns and tool-call/result pairs, and consider adding a maximum iteration limit for tool calls.

## How tool calling works

The tool flow is:

1. The user asks a question, such as `25 multiply by 4`.
2. `modelWithTools.invoke(...)` sends the messages to the model with tool definitions available.
3. The model may return a tool call in `response.tool_calls`.
4. `executeToolCalls(...)` runs the requested JavaScript tool.
5. The result is added to the message history as a `ToolMessage`, linked by `tool_call_id`.
6. The model is invoked again with the tool result.
7. The model returns a normal answer, which is printed in the terminal.

A model does not execute the JavaScript function by itself. The application receives the requested tool call and executes the function.

## Conversation history

The `messages` array stores the system prompt and the messages exchanged in the current session.

```javascript
const messages = [systemPrompt];
```

When a user asks a question, a `HumanMessage` is added. The final AI response is added after the model has finished any tool calls.

The `clear` command uses:

```javascript
messages.length = 1;
```

This removes the conversation messages but keeps the system prompt at index `0`.

To reduce token usage, the current implementation sends the system prompt plus a recent-message window to the model. This reduces the number of messages sent per request, but it does not guarantee a fixed token count: a few long messages can still consume many tokens. A future improvement is to trim complete conversation turns and tool interactions safely, or use a token-aware history strategy.

## Run the chatbot

Start the program:

```bash
node server.js
```

## Test prompts

Try these prompts in the terminal:

```text
Hello, how are you?
25 multiply by 4
12 multiply by 8
help
clear
exit
```

Expected multiplication results:

- `25 × 4` → `100`
- `12 × 8` → `96`

The exact wording of the AI's final response may differ.

## Important notes and next steps

- Keep `.env` private and never publish the API key.
- Verify that the selected Groq model ID is currently supported.
- Improve recent-history trimming so tool-call messages and tool results remain together.
- Consider a maximum tool-call loop count to avoid endless tool cycles.
- Add more tools, such as addition, subtraction, or a date/time helper.
- Add better input validation and clearer error messages.
- Add tests for tool execution and conversation history.

---

Built while learning Node.js, LangChain, and tool calling step by step.
"""

output_path = "/mnt/data/README.md"
pypandoc.convert_text(content, "md", format="md", outputfile=output_path, extra_args=["--standalone"])
print(f"Created {output_path}")
