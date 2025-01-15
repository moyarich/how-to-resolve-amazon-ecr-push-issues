#!/bin/bash
###################################################################
# 1 megabyte (MB) is equal to 1,048,576 bytes (1024 × 1024) in the binary system
# An empty image is less than 1,048,576 bytes
# Author : Moya Richards
###################################################################

is_command_present() {
    type "$1" >/dev/null 2>&1
}

install_jq() {
    printf "\n${YELLOW}PACKAGE CHECK:${NC}Ensuring that you are up to date on the following package: ${RED}jq${NC}\n"

    printf "\n${GREEN}Checking for jq installation.${NC}\n"

    # Check for jq installation
    if is_command_present "jq"; then
        echo "jq is already installed."
    else
        brew install jq
    fi
}

delete_empty_images_from_ecr() {

    # Default region to AWS_DEFAULT_REGION or us-east-1 if not set
    region="${AWS_DEFAULT_REGION:-us-east-1}"

    # Parse command line arguments
    while [[ "$#" -gt 0 ]]; do
        case "$1" in
        --region)
            region="$2"
            shift 2
            ;;

        -h | --help)
            echo "Usage: $0 delete_empty_images_from_ecr [--region REGION]"
            echo ""
            echo "Deletes empty images from Amazon ECR repositories in the specified or default AWS region."
            echo ""
            echo "Options:"
            echo "  --region REGION  Specify the AWS region (default: AWS_DEFAULT_REGION or us-east-1)"
            echo "  -h, --help       Display this help message and exit"
            return 0
            ;;
        *)
            echo "Error: Unknown parameter: $1"
            echo "Use '$0 delete_empty_images_from_ecr --help' for usage information."
            return 1
            ;;
        esac
    done

    install_jq

    #==============================
    repositories=$(aws ecr describe-repositories --region $region --query 'repositories[*].repositoryName' --output text)

    for repo in $repositories; do
        echo "\nProcessing repository: $repo"

        # Get the list of image digests in the repository
        image_ids=$(aws ecr list-images --repository-name $repo --region $region --query 'imageIds[*]' --output json)

        echo $image_ids | jq -c '.[]' | while read -r image; do
            digest=$(echo $image | jq -r '.imageDigest')

            # Get the image details
            image_details=$(aws ecr describe-images --repository-name $repo --image-ids imageDigest=$digest --region $region)
            #echo "image_details for $tags:\n $image_details"

            # Get all tags for this image
            tags=$(echo $image_details | jq -r '.imageDetails[0].imageTags[]' 2>/dev/null | tr '\n' ',' | sed 's/,$//')

            image_size=$(echo $image_details | jq '.imageDetails[0].imageSizeInBytes')

            #if image_size=1620 bytes, it is 0 bytes
            image_size_megabyte=$(echo "scale=6; $image_size / (1024 * 1024)" | bc)

            echo -e "\nImage Digest: $digest\nRepository Name: $repo\nImage Tags: $tags\nImage Size: $image_size bytes ($image_size_megabyte MB)"

            # Check if the image size is 0 megabytes [ie: 1620 bytes - less than 1,048,576 bytes]
            is_less_than_one_megabyte=$(echo "$image_size_megabyte < 1" | bc -l)

            # Check if the result is 1 (true)
            if [ "$is_less_than_one_megabyte" -eq 1 ]; then
                echo "Image is empty, deleting image with digest $digest"
                aws ecr batch-delete-image --repository-name $repo --image-ids imageDigest=$digest --region $region

                # Run the AWS ECR delete command
                output=$(aws ecr batch-delete-image --repository-name $repo --image-ids imageDigest=$digest --region $region)

                # Check for failures or success
                echo "$output" | jq '
                if .failures | length > 0 then
                    "Deletion Failure: \(.failures[0].failureReason)"
                else
                    "Success: Image deleted"
                end'
            else
                echo "Image Size: $image_size bytes\nImage not empty [image not deleted]"
            fi
        done
    done
}

# If the script is being run directly (not sourced), call the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    delete_empty_images_from_ecr.sh "$@"
fi
