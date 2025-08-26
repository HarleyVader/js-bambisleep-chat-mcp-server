#!/usr/bin/env node

/**
 * 🤖 BambiSleep Multi-Agent Build Script
 * Builds all agents in the /agent folder for deployment
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AGENT_FOLDER = join(__dirname, '..', 'agent');
const AGENT_PREFIX = 'js-bambisleep-chat-agent-';

console.log('🚀 Building BambiSleep Agents...');
console.log(`📁 Scanning for agents in: ${AGENT_FOLDER}`);

async function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'pipe',
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
            }
        });
    });
}

async function buildAgent(agentPath, agentName) {
    console.log(`\n🤖 Processing agent: ${agentName}`);

    const packageJsonPath = join(agentPath, 'package.json');

    try {
        // Check if package.json exists
        await stat(packageJsonPath);

        // Read package.json
        const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        const version = packageJson.version || '1.0.0';

        console.log(`  📦 Version: ${version}`);

        // Install dependencies
        console.log('  🔧 Installing dependencies...');
        await runCommand('npm', ['install'], agentPath);

        // Build agent
        console.log('  🏗️ Building agent...');
        await runCommand('npm', ['run', 'build'], agentPath);

        // Check if dist folder was created
        const distPath = join(agentPath, 'dist');
        try {
            const distStats = await stat(distPath);
            if (distStats.isDirectory()) {
                const distContents = await readdir(distPath);
                console.log(`  ✅ Build successful! Generated ${distContents.length} files in dist/`);
                return true;
            }
        } catch {
            throw new Error('Build completed but no dist folder found');
        }

    } catch (error) {
        console.log(`  ❌ Build failed: ${error.message}`);
        return false;
    }
}

async function main() {
    try {
        // Check if agent folder exists
        await stat(AGENT_FOLDER);

        // Find all agent directories
        const entries = await readdir(AGENT_FOLDER, { withFileTypes: true });
        const agentDirs = entries.filter(entry =>
            entry.isDirectory() && entry.name.startsWith(AGENT_PREFIX)
        );

        if (agentDirs.length === 0) {
            console.log(`⚠️ No agents found matching pattern '${AGENT_PREFIX}*'`);
            process.exit(0);
        }

        let builtAgents = 0;
        const failedAgents = [];

        for (const agentDir of agentDirs) {
            const agentPath = join(AGENT_FOLDER, agentDir.name);
            const agentName = agentDir.name.replace(AGENT_PREFIX, '');

            const success = await buildAgent(agentPath, agentName);
            if (success) {
                builtAgents++;
            } else {
                failedAgents.push(agentName);
            }
        }

        console.log('\n📊 Build Summary:');
        console.log(`  ✅ Successfully built: ${builtAgents} agents`);

        if (failedAgents.length > 0) {
            console.log(`  ❌ Failed builds: ${failedAgents.length} agents`);
            failedAgents.forEach(agent => {
                console.log(`    - ${agent}`);
            });
        }

        console.log('\n🚀 Build process completed!');

        if (failedAgents.length > 0) {
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Build script failed:', error.message);
        process.exit(1);
    }
}

main();
