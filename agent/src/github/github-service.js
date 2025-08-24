const { Octokit } = require('@octokit/rest');

class GitHubService {
    constructor() {
        this.octokit = null;
        this.authenticated = false;
    }

    async initialize() {
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_TOKEN is required for GitHub integration');
        }

        this.octokit = new Octokit({
            auth: token,
            userAgent: 'MCP-Agent/1.0.0'
        });

        try {
            // Test authentication
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            this.authenticated = true;
            console.log(`🐙 GitHub authenticated as: ${user.login}`);
        } catch (error) {
            throw new Error(`GitHub authentication failed: ${error.message}`);
        }
    }

    async executeOperation(operation) {
        if (!this.authenticated) {
            throw new Error('GitHub service not authenticated');
        }

        const { type, payload } = operation;

        switch (type) {
            case 'create-pr':
                return await this.createPullRequest(payload);
            case 'list-repos':
                return await this.listRepositories(payload);
            case 'get-repo':
                return await this.getRepository(payload);
            case 'create-issue':
                return await this.createIssue(payload);
            case 'list-issues':
                return await this.listIssues(payload);
            case 'comment-pr':
                return await this.commentOnPullRequest(payload);
            case 'merge-pr':
                return await this.mergePullRequest(payload);
            default:
                throw new Error(`Unknown GitHub operation: ${type}`);
        }
    }

    async createPullRequest({ owner, repo, title, body, head, base = 'main' }) {
        try {
            const { data } = await this.octokit.rest.pulls.create({
                owner,
                repo,
                title,
                body,
                head,
                base
            });

            console.log(`✅ Created PR #${data.number}: ${title}`);
            return {
                number: data.number,
                url: data.html_url,
                state: data.state,
                title: data.title
            };
        } catch (error) {
            throw new Error(`Failed to create PR: ${error.message}`);
        }
    }

    async listRepositories({ type = 'all', sort = 'updated', per_page = 30 } = {}) {
        try {
            const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
                type,
                sort,
                per_page
            });

            return {
                repositories: data.map(repo => ({
                    name: repo.name,
                    full_name: repo.full_name,
                    private: repo.private,
                    clone_url: repo.clone_url,
                    html_url: repo.html_url,
                    updated_at: repo.updated_at
                })),
                count: data.length
            };
        } catch (error) {
            throw new Error(`Failed to list repositories: ${error.message}`);
        }
    }

    async getRepository({ owner, repo }) {
        try {
            const { data } = await this.octokit.rest.repos.get({
                owner,
                repo
            });

            return {
                name: data.name,
                full_name: data.full_name,
                description: data.description,
                private: data.private,
                clone_url: data.clone_url,
                html_url: data.html_url,
                default_branch: data.default_branch,
                language: data.language,
                stargazers_count: data.stargazers_count,
                forks_count: data.forks_count
            };
        } catch (error) {
            throw new Error(`Failed to get repository: ${error.message}`);
        }
    }

    async createIssue({ owner, repo, title, body, labels = [], assignees = [] }) {
        try {
            const { data } = await this.octokit.rest.issues.create({
                owner,
                repo,
                title,
                body,
                labels,
                assignees
            });

            console.log(`✅ Created issue #${data.number}: ${title}`);
            return {
                number: data.number,
                url: data.html_url,
                state: data.state,
                title: data.title
            };
        } catch (error) {
            throw new Error(`Failed to create issue: ${error.message}`);
        }
    }

    async listIssues({ owner, repo, state = 'open', per_page = 30 }) {
        try {
            const { data } = await this.octokit.rest.issues.listForRepo({
                owner,
                repo,
                state,
                per_page
            });

            return {
                issues: data.map(issue => ({
                    number: issue.number,
                    title: issue.title,
                    state: issue.state,
                    html_url: issue.html_url,
                    created_at: issue.created_at,
                    updated_at: issue.updated_at,
                    labels: issue.labels.map(label => label.name)
                })),
                count: data.length
            };
        } catch (error) {
            throw new Error(`Failed to list issues: ${error.message}`);
        }
    }

    async commentOnPullRequest({ owner, repo, pull_number, body }) {
        try {
            const { data } = await this.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: pull_number,
                body
            });

            console.log(`✅ Commented on PR #${pull_number}`);
            return {
                id: data.id,
                url: data.html_url,
                created_at: data.created_at
            };
        } catch (error) {
            throw new Error(`Failed to comment on PR: ${error.message}`);
        }
    }

    async mergePullRequest({ owner, repo, pull_number, commit_title, commit_message, merge_method = 'merge' }) {
        try {
            const { data } = await this.octokit.rest.pulls.merge({
                owner,
                repo,
                pull_number,
                commit_title,
                commit_message,
                merge_method
            });

            console.log(`✅ Merged PR #${pull_number}`);
            return {
                sha: data.sha,
                merged: data.merged,
                message: data.message
            };
        } catch (error) {
            throw new Error(`Failed to merge PR: ${error.message}`);
        }
    }

    async getAuthenticatedUser() {
        try {
            const { data } = await this.octokit.rest.users.getAuthenticated();
            return {
                login: data.login,
                id: data.id,
                avatar_url: data.avatar_url,
                html_url: data.html_url,
                name: data.name,
                email: data.email
            };
        } catch (error) {
            throw new Error(`Failed to get authenticated user: ${error.message}`);
        }
    }
}

module.exports = GitHubService;
