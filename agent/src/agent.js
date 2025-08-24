/**
 * MCP Agent Docking System
 * Manages React Agent Dr Girlfriend application lifecycle
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

class MCPAgent {
    constructor() {
        this.agentProcess = null;
        this.agentPath = path.join(__dirname, '..', 'js-bambisleep-chat-agent-dr-girlfriend');
        this.isRunning = false;
    }

    async start() {
        console.log('🇦🇹 Starting Agent Dr Girlfriend...');

        // Check if agent directory exists
        if (!await fs.pathExists(this.agentPath)) {
            console.error('❌ Agent Dr Girlfriend not found at:', this.agentPath);
            console.log('🔧 Please ensure the React agent is in the correct location');
            return false;
        }

        // Check if agent has dependencies installed
        const nodeModulesPath = path.join(this.agentPath, 'node_modules');
        if (!await fs.pathExists(nodeModulesPath)) {
            console.log('📦 Installing Agent Dr Girlfriend dependencies...');
            await this.installDependencies();
        }

        // Start the React development server
        return this.startReactAgent();
    }

    async installDependencies() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Installing dependencies for Agent Dr Girlfriend...');

            const npmInstall = spawn('npm', ['install'], {
                cwd: this.agentPath,
                stdio: 'inherit',
                shell: process.platform === 'win32'
            });

            npmInstall.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Dependencies installed successfully');
                    resolve();
                } else {
                    console.error('❌ Failed to install dependencies');
                    reject(new Error(`npm install failed with code ${code}`));
                }
            });
        });
    }

    async startReactAgent() {
        return new Promise((resolve) => {
            console.log('🚀 Starting Agent Dr Girlfriend React application...');

            this.agentProcess = spawn('npm', ['run', 'dev'], {
                cwd: this.agentPath,
                stdio: 'inherit',
                shell: process.platform === 'win32'
            });

            this.agentProcess.on('spawn', () => {
                this.isRunning = true;
                console.log('✅ Agent Dr Girlfriend is starting up...');
                console.log('🌐 Agent will be available at http://localhost:3004');
                console.log('🇦🇹 Austrian GDPR-compliant AI companion ready for docking');
                resolve(true);
            });

            this.agentProcess.on('error', (err) => {
                console.error('❌ Failed to start Agent Dr Girlfriend:', err.message);
                this.isRunning = false;
                resolve(false);
            });

            this.agentProcess.on('close', (code) => {
                console.log(`🔄 Agent Dr Girlfriend process exited with code ${code}`);
                this.isRunning = false;
            });
        });
    }

    async stop() {
        if (this.agentProcess && this.isRunning) {
            console.log('🛑 Stopping Agent Dr Girlfriend...');
            this.agentProcess.kill('SIGTERM');
            this.isRunning = false;
            return true;
        }
        return false;
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            agentPath: this.agentPath,
            pid: this.agentProcess ? this.agentProcess.pid : null
        };
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🔄 Gracefully shutting down MCP Agent...');
    if (global.mcpAgent) {
        await global.mcpAgent.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🔄 Gracefully shutting down MCP Agent...');
    if (global.mcpAgent) {
        await global.mcpAgent.stop();
    }
    process.exit(0);
});

// Main execution
async function main() {
    console.log('🇦🇹 MCP Agent Docking System - Austrian GDPR Compliant');
    console.log('='.repeat(60));

    const agent = new MCPAgent();
    global.mcpAgent = agent;

    try {
        const started = await agent.start();
        if (started) {
            console.log('🎉 Agent Dr Girlfriend docking system operational');
            console.log('🔗 Ready for MCP server integration');

            // Keep the process alive
            setInterval(() => {
                const status = agent.getStatus();
                if (!status.isRunning) {
                    console.log('⚠️  Agent Dr Girlfriend stopped unexpectedly');
                    process.exit(1);
                }
            }, 30000); // Check every 30 seconds

        } else {
            console.error('❌ Failed to start Agent Dr Girlfriend');
            process.exit(1);
        }
    } catch (error) {
        console.error('💥 Critical error in MCP Agent:', error.message);
        process.exit(1);
    }
}

// Start the agent if this file is run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = MCPAgent;
