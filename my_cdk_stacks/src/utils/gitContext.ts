import * as path from "path";
import gitBranch from "git-branch";
import * as fs from "fs";

/**
 * Retrieves the current Git branch name and generates a sanitized app stack name.
 * If the Git context cannot be found, it returns default values.
 *
 * @returns {Object} An object containing the current Git branch and the app stack name.
 */
export const getGitContext = () => {
  // Default branch name if no Git context is found
  const defaultNameIfGitIsMissing = "dev";

  /**
   * Searches for a directory containing a specific folder (e.g., ".git") starting from the current directory
   * and going upwards in the directory tree.
   *
   * @param {string} directoryName The name of the directory to search for (e.g., ".git").
   * @returns {string} The path to the directory containing the folder, or an empty string if not found.
   */
  const findDirUp = (directoryName: string): string => {
    let cwd = process.cwd();

    // Array of possible file system root directories for cross-platform compatibility
    const rootDirs = ["/", "C:\\"];

    // Loop to traverse upwards in the directory tree until the root directory is reached
    while (!rootDirs.includes(cwd)) {
      try {
        // Read the current directory to check for the target folder
        const directories = fs.readdirSync(cwd);

        // If the directory contains the target folder, return the current path
        if (directories.includes(directoryName)) {
          return cwd;
        }

        // Move up one level in the directory tree
        cwd = path.dirname(cwd);
      } catch (err) {
        // Log error if unable to read the directory and stop the search
        console.error(`Error reading directory ${cwd}:`, err);
        return "";
      }
    }

    // Log a message if no directory containing the target folder is found
    console.log("GetContext: No .git parent directory found.");
    return "";
  };

  // Search for a Git repository by looking for the ".git" folder upwards from the current directory
  const gitDirectory = findDirUp(".git");

  // If a Git repository is found, get the current Git branch; otherwise, use the default branch name
  const currentGitBranch = gitDirectory
    ? gitBranch.sync(gitDirectory)
    : defaultNameIfGitIsMissing;

  // Sanitize the branch name by replacing non-alphanumeric characters with dashes and limit its length for CloudFormation compatibility
  const appStackName = currentGitBranch
    .replace(/[^\w-]/g, "-")
    .substring(0, 122);

  // Return the current Git branch and the sanitized app stack name
  return {
    currentGitBranch,
    appStackName,
  };
};
