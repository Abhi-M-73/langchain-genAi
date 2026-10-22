import readline from 'node:readline'
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import model from './model.js';
import multiplyNumbers from './tools.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const systemPrompt = new SystemMessage(
    "You are a friendly coding teacher. You are expert in javascript and Mern." +
    "Don't add comments into response. " +
    "Give me exact answer simple and short " +
    "Explain programming concepts in simple English. "
);

const messages = [systemPrompt];
const modelWithTools = model.bindTools([multiplyNumbers]);


const executeToolCalls = async (response, messages) => {
    messages.push(response);

    for (const toolCall of response.tool_calls) {
        if (toolCall.name === "multiply_numbers") {
            const result = await multiplyNumbers.invoke(
                toolCall.args
            );

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

        if (ans.toLowerCase() === "exit") {
            console.log("Chatbot closed!");
            rl.close();
            return;
        }

        if (ans.toLowerCase() === "clear") {
            messages.length = 1
            console.log("History cleared!");
            askQuestion();
            return;
        }

        if (ans.toLowerCase() === "help") {
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

        const getRecentMessages = () => [
            messages[0],
            ...messages.slice(1).slice(-10),
        ];
        try {
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
        askQuestion()
    })
}

askQuestion()

