
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const operation1 = async ({ a, b }) => {
    return a * b;
}

const operation1Details = {
    name: "multiply_numbers",
    description: "Multiply two numbers together.",
    schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
    }),
}

const multiplyNumbers = tool(operation1, operation1Details);

export default multiplyNumbers;
