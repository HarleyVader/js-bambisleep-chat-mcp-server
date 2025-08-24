const simpleGit = require('simple-git');
const fs = require('fs-extra');
const path = require('path');

class GitService {
    constructor() {
        this.workspaceDir = process.env.GIT_WORKSPACE_DIR || './workspace';
        this.git = null;
    }

    async initialize() {
        // Ensure workspace directory exists
        await fs.ensureDir(this.workspaceDir);
        console.log(`📁 Git workspace initialized: ${this.workspaceDir}`);
    }

    async executeOperation(operation) {
        const { type, payload } = operation;

        switch (type) {
            case 'clone':
                return await this.cloneRepository(payload);
            case 'checkout':
                return await this.checkoutBranch(payload);
            case 'create-branch':
                return await this.createBranch(payload);
            case 'commit':
                return await this.commitChanges(payload);
            case 'push':
                return await this.pushChanges(payload);
            case 'pull':
                return await this.pullChanges(payload);
            case 'status':
                return await this.getStatus(payload);
            case 'add':
                return await this.addFiles(payload);
            case 'diff':
                return await this.getDiff(payload);
            default:
                throw new Error(`Unknown git operation: ${type}`);
        }
    }

    async cloneRepository({ url, name, branch = 'main' }) {
        try {
            const repoPath = path.join(this.workspaceDir, name);

            // Remove existing directory if it exists
            if (await fs.pathExists(repoPath)) {
                await fs.remove(repoPath);
            }

            const git = simpleGit();
            await git.clone(url, repoPath, ['--branch', branch]);

            console.log(`✅ Cloned repository: ${name}`);
            return {
                name,
                path: repoPath,
                branch,
                url
            };
        } catch (error) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        }
    }

    async checkoutBranch({ repoName, branch, create = false }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            if (create) {
                await git.checkoutLocalBranch(branch);
            } else {
                await git.checkout(branch);
            }

            console.log(`✅ Checked out branch: ${branch}`);
            return {
                branch,
                repoName,
                path: repoPath
            };
        } catch (error) {
            throw new Error(`Failed to checkout branch: ${error.message}`);
        }
    }

    async createBranch({ repoName, branch, fromBranch = 'main' }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            // Ensure we're on the base branch first
            await git.checkout(fromBranch);
            await git.pull();

            // Create and checkout new branch
            await git.checkoutLocalBranch(branch);

            console.log(`✅ Created branch: ${branch} from ${fromBranch}`);
            return {
                branch,
                fromBranch,
                repoName,
                path: repoPath
            };
        } catch (error) {
            throw new Error(`Failed to create branch: ${error.message}`);
        }
    }

    async commitChanges({ repoName, message, files = ['.'] }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            // Add files
            await git.add(files);

            // Commit changes
            const result = await git.commit(message);

            console.log(`✅ Committed changes: ${message}`);
            return {
                hash: result.commit,
                message,
                files,
                repoName
            };
        } catch (error) {
            throw new Error(`Failed to commit changes: ${error.message}`);
        }
    }

    async pushChanges({ repoName, remote = 'origin', branch }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            // Get current branch if not specified
            if (!branch) {
                const status = await git.status();
                branch = status.current;
            }

            await git.push(remote, branch);

            console.log(`✅ Pushed changes to ${remote}/${branch}`);
            return {
                remote,
                branch,
                repoName
            };
        } catch (error) {
            throw new Error(`Failed to push changes: ${error.message}`);
        }
    }

    async pullChanges({ repoName, remote = 'origin', branch }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            if (branch) {
                await git.pull(remote, branch);
            } else {
                await git.pull();
            }

            console.log(`✅ Pulled changes from ${remote}${branch ? `/${branch}` : ''}`);
            return {
                remote,
                branch,
                repoName
            };
        } catch (error) {
            throw new Error(`Failed to pull changes: ${error.message}`);
        }
    }

    async getStatus({ repoName }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            const status = await git.status();

            return {
                current: status.current,
                tracking: status.tracking,
                ahead: status.ahead,
                behind: status.behind,
                created: status.created,
                deleted: status.deleted,
                modified: status.modified,
                renamed: status.renamed,
                staged: status.staged,
                files: status.files
            };
        } catch (error) {
            throw new Error(`Failed to get status: ${error.message}`);
        }
    }

    async addFiles({ repoName, files }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            await git.add(files);

            console.log(`✅ Added files: ${Array.isArray(files) ? files.join(', ') : files}`);
            return {
                files,
                repoName
            };
        } catch (error) {
            throw new Error(`Failed to add files: ${error.message}`);
        }
    }

    async getDiff({ repoName, from, to }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const git = simpleGit(repoPath);

            let diff;
            if (from && to) {
                diff = await git.diff([`${from}..${to}`]);
            } else if (from) {
                diff = await git.diff([from]);
            } else {
                diff = await git.diff();
            }

            return {
                diff,
                from,
                to,
                repoName
            };
        } catch (error) {
            throw new Error(`Failed to get diff: ${error.message}`);
        }
    }

    async writeFile({ repoName, filePath, content }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const fullPath = path.join(repoPath, filePath);

            // Ensure directory exists
            await fs.ensureDir(path.dirname(fullPath));

            // Write file
            await fs.writeFile(fullPath, content, 'utf8');

            console.log(`✅ Wrote file: ${filePath}`);
            return {
                filePath,
                repoName,
                fullPath
            };
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    async readFile({ repoName, filePath }) {
        try {
            const repoPath = path.join(this.workspaceDir, repoName);
            const fullPath = path.join(repoPath, filePath);

            const content = await fs.readFile(fullPath, 'utf8');

            return {
                filePath,
                content,
                repoName
            };
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
    }
}

module.exports = GitService;
