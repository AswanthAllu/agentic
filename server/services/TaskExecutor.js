// server/services/TaskExecutor.js
const serviceManager = require('./serviceManager');
const File = require('../models/File');

const TOOL_NAMES = {
    WEB_SEARCH: 'web_search',
    FILE_SEARCH: 'file_search',
    READ_FILE: 'read_file',
    SUMMARIZE: 'summarize',
    GENERATE_REPORT: 'generate_report'
};

class TaskExecutor {
    constructor(serviceManager) {
        this.serviceManager = serviceManager;
    }

    getTools() {
        const { multiLLMManager, duckDuckGo, vectorStore, documentProcessor } = this.serviceManager.getServices();
        return {
            [TOOL_NAMES.WEB_SEARCH]: async (input) => {
                const results = await duckDuckGo.performSearch(input, 'text');
                return results.results.slice(0, 3).map(r => `Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
            },
            [TOOL_NAMES.FILE_SEARCH]: async (input, userId) => {
                const results = await vectorStore.searchDocuments(input, { filters: { userId } });
                return results.slice(0, 3).map(r => `Source: ${r.metadata.source}\nContent: ${r.content.substring(0, 200)}...`).join('\n\n');
            },
            [TOOL_NAMES.READ_FILE]: async (fileId) => {
                const file = await File.findById(fileId);
                if (!file) return 'Error: File not found.';
                return documentProcessor.parseFile(file.path, file.mimetype);
            },
            [TOOL_NAMES.SUMMARIZE]: async (input) => {
                const summary = await multiLLMManager.generateSummary(input);
                return summary.text;
            },
            [TOOL_NAMES.GENERATE_REPORT]: async (input) => {
                return multiLLMManager.generateReport(input, 'Generated Report');
            }
        };
    }

    async executeTask(userQuery, userId) {
        const tools = this.getTools();
        const { multiLLMManager } = this.serviceManager.getServices();
        const plannerModel = multiLLMManager.getReasoningModel(userQuery);

        const planPrompt = `You are a helpful assistant with access to the following tools:
- ${TOOL_NAMES.WEB_SEARCH}(query): Searches the web for information.
- ${TOOL_NAMES.FILE_SEARCH}(query, userId): Searches user's documents for information.
- ${TOOL_NAMES.READ_FILE}(fileId): Reads the full content of a user's file.
- ${TOOL_NAMES.SUMMARIZE}(text): Summarizes a block of text.
- ${TOOL_NAMES.GENERATE_REPORT}(content): Generates a formal report from content.

Based on the user's request, formulate a step-by-step plan using these tools. Each step should be a single tool call. The final step should be to respond to the user.
User Request: ${userQuery}
Plan:`;

        const planResponse = await plannerModel.generateText(planPrompt);
        const plan = this.parsePlan(planResponse);

        let finalAnswer = '';
        for (const step of plan) {
            const toolFunc = tools[step.tool];
            if (toolFunc) {
                try {
                    console.log(`Executing tool: ${step.tool} with args: ${JSON.stringify(step.args)}`);
                    const result = await toolFunc(...step.args.map(arg => {
                        if (arg === 'userId') return userId;
                        if (arg.startsWith('$')) return finalAnswer;
                        return arg;
                    }));
                    finalAnswer += `\n\nResult from ${step.tool}: ${result}`;
                } catch (error) {
                    console.error(`Error executing tool ${step.tool}:`, error);
                    finalAnswer += `\n\nError executing ${step.tool}: ${error.message}`;
                }
            }
        }
        
        const synthesisPrompt = `Based on the following plan execution results, provide a final, comprehensive answer to the user's original request.
Original Request: ${userQuery}
Results: ${finalAnswer}
Final Answer:`;
        return plannerModel.generateText(synthesisPrompt);
    }
    
    parsePlan(planText) {
        const steps = [];
        const lines = planText.split('\n');
        for (const line of lines) {
            const match = line.match(/(\w+)\((.*)\)/);
            if (match) {
                const tool = match[1];
                const args = match[2].split(',').map(arg => arg.trim().replace(/^['"]|['"]$/g, ''));
                steps.push({ tool, args });
            }
        }
        return steps;
    }
}

module.exports = TaskExecutor;
