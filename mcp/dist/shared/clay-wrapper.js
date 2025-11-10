/**
 * Wrapper for executing Clay CLI commands
 */
import { execSync } from 'child_process';
import fs from 'fs';
/**
 * Execute a Clay CLI command in the specified working directory
 */
export function executeClayCommand(command, args, workingDirectory) {
    try {
        const argString = args.join(' ');
        const fullCommand = `clay ${command} ${argString}`.trim();
        // Use shell execution with output redirection to capture output
        // while still allowing child processes to execute properly
        const output = execSync(`${fullCommand} 2>&1`, {
            cwd: workingDirectory,
            encoding: 'utf8',
            shell: '/bin/bash',
            env: {
                ...process.env,
                VERBOSE: 'true',
            },
        });
        return {
            success: true,
            output: output.toString(),
        };
    }
    catch (error) {
        const err = error;
        return {
            success: false,
            output: err.stdout?.toString() || '',
            error: err.stderr?.toString() || err.message || 'Unknown error',
        };
    }
}
/**
 * Check if Clay CLI is available
 */
export function isClayAvailable() {
    try {
        execSync('clay --version', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get Clay CLI version
 */
export function getClayVersion() {
    try {
        const output = execSync('clay --version', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return output.trim();
    }
    catch {
        return null;
    }
}
/**
 * Parse Clay generate output to extract statistics
 */
export function parseGenerateOutput(output) {
    // Clay outputs different colored messages for file operations:
    // - "writing: " for generated/updated files
    // - "copying: " for copied files
    // - "moving: " for moved files
    // Count occurrences of these patterns
    const writing = (output.match(/writing:/gi) || []).length;
    const copying = (output.match(/copying:/gi) || []).length;
    const moving = (output.match(/moving:/gi) || []).length;
    return {
        filesGenerated: writing,
        filesUpdated: 0, // Clay doesn't distinguish between new and updated in output
        filesUnchanged: 0, // Clay doesn't output unchanged files
        filesCopied: copying,
        filesMoved: moving,
    };
}
/**
 * Read and parse .clay file
 */
export function readClayFile(clayFilePath) {
    const content = fs.readFileSync(clayFilePath, 'utf8');
    return JSON.parse(content);
}
//# sourceMappingURL=clay-wrapper.js.map