#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define a reusable `sedi()` function to handle sed portability
sedi() {
    # Usage: sedi 's/find/replace/' filename
    if sed --version >/dev/null 2>&1; then
        # GNU sed (Linux)
        sed -i "$@"
    else
        # BSD sed (macOS)
        sed -i "" "$@"
    fi
}

# Function to calculate relative path
relpath() {
    local source=$1
    local target=$2

    local common_part=$source
    local result=""

    while [[ "${target#$common_part}" == "${target}" ]]; do
        common_part="$(dirname "$common_part")"
        if [[ -z $result ]]; then
            result=".."
        else
            result="../$result"
        fi
    done

    if [[ $common_part == "/" ]]; then
        result="$result/"
    fi

    local forward_part="${target#$common_part}"
    if [[ -n $result ]] && [[ -n $forward_part ]]; then
        result="$result${forward_part#/}"
    elif [[ -n $forward_part ]]; then
        result="${forward_part#/}"
    fi

    echo "$result"
}

# Get the directory of this script
current_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$current_dir"

# Set the location of the README file (adjustable to be easily moved)
output_dir="${OUTPUT_DIR:-$current_dir/../}"
readme_file="$output_dir/README.md"

# Default image folder name relative to the output directory
asset_folder="${asset_folder:-$output_dir/doc-images}"

# Ensure output directories exist
mkdir -p "$output_dir" "$asset_folder"

echo "Output directory: $output_dir"
echo "Asset folder: $asset_folder"

#====================
# Step 1: Recursively find and copy files from 'images' subfolders to the doc-images folder, preserving only the subfolder under 'images'
# Define allowed file types
allowed_files=("*.png" "*.jpeg" "*.jpg" "*.pptx" "*.pdf" "*.drawio")
source="$current_dir/src"

# Ensure the source directory exists
if [ ! -d "$source" ]; then
    echo "Error: Source directory '$source' does not exist."
    exit 1
fi

for ext in "${allowed_files[@]}"; do
    find "$source" -type f -iname "$ext" -exec sh -c '
        src_file="$1"
        asset_folder="$2"
        file_directory=$(dirname "$src_file")
        
        # Extract the parent directory under "images" or "assets"
        parent_dir=$(echo "$file_directory" | awk -F "/(images|assets)/" "{print \$2}")
        
        # Create the corresponding target directory
        target_dir="$asset_folder/$parent_dir"
        mkdir -p "$target_dir"
        
        # Copy the file to the target directory
        cp "$src_file" "$target_dir/"
        
        echo "Copied: $src_file -> $target_dir"
    ' sh {} "$asset_folder" \;
done

# Step 2: Generate a README.md with a table of contents from the 'src' directory.
npx concat-md --toc --decrease-title-levels --title-key title --dir-name-as-title src >"$readme_file"

# Step 3: Calculate relative path for image folder
readme_dir="$(cd "$(dirname "$readme_file")" && pwd)"
asset_dir="$(cd "$asset_folder" && pwd)"
relative_asset_folder=$(relpath "$readme_dir" "$asset_dir")

# Update the image paths in README.md to the relative image folder
# from ![Architecture](./images/arabelle/Architecture.png)
# to ![Architecture](./doc-images/arabelle/Architecture.png)
awk -v relative_path="$relative_asset_folder" '{
    gsub(/\(\.\/images\//, "(" relative_path "/");
    gsub(/\(\.\/assets\//, "(" relative_path "/");
    print
}' "$readme_file" >"${readme_file}.tmp" && mv "${readme_file}.tmp" "$readme_file"

# Step 4: Remove numeric prefixes from markdown headers in the README while preserving structure.
sedi -E 's/^([#]+) [0-9]+ (.+)/\1 \2/' "$readme_file"

# Step 5: Remove numeric prefixes from the table of contents text inside the brackets.
sedi -E 's/- \[([0-9]+ )(.+)\]/- [\2]/' "$readme_file"

echo "Build script completed successfully."
