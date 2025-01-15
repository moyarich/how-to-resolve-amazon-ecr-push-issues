#!/bin/bash
###################################################################
# Author : Moya Richards
###################################################################

build_and_push_docker_images_to_ecr() {
    # Default region to AWS_DEFAULT_REGION or us-east-1 if not set
    region="${AWS_DEFAULT_REGION:-us-east-1}"
    tag="latest"
    image_name=""
    build_context="."

    # Parse command line arguments
    while [[ "$#" -gt 0 ]]; do
        case "$1" in
        --image-name)
            image_name="$2"
            shift 2
            ;;
        --tag)
            tag="$2"
            shift 2
            ;;
        --build-context)
            build_context="$2"
            shift 2
            ;;
        --region)
            region="$2"
            shift 2
            ;;
        -h | --help)
            echo "Usage: $0 build_and_push_docker_images_to_ecr --image-name image_name [--tag TAG] [--region REGION]"
            echo ""
            echo "Builds and pushes a Docker image to Amazon ECR."
            echo ""
            echo "Options:"

            echo "  --image-name image_name  The name of the Docker image to build and push (required)."
            echo "  --tag tag                The tag for the Docker image (default: latest)."
            echo "  --build-context build_context              The build_context to the docker image source code."
            echo "  --region REGION          The AWS region (default: AWS_DEFAULT_REGION or us-east-1)."
            echo "  -h, --help               Display this help message and exit."
            return 0
            ;;
        *)
            echo "Error: Unknown parameter: $1"
            echo "Use '$0 build_and_push_docker_images_to_ecr --help' for usage information."
            return 1
            ;;
        esac
    done

    # Validate required parameters
    if [[ -z "$image_name" ]]; then
        echo "Error: --image-name is required."
        echo "Use '$0 build_and_push_docker_images_to_ecr --help' for usage information."
        return 1
    fi

    echo "Building and pushing Docker image..."
    echo "Image Name: $image_name"
    echo "Tag: $tag"
    echo "Region: $region"

    # Get AWS account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
    if [[ $? -ne 0 ]]; then
        echo "Error: Unable to retrieve AWS account ID. Ensure AWS CLI is configured correctly."
        return 1
    fi

    # Set variables

    REGION=$(aws configure get region --profile "${AWS_PROFILE}")

    REPOSITORY_NAME="cdk-hnb659fds-container-assets-${ACCOUNT_ID}-${REGION}"

    REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    FULL_image_name="${REGISTRY}/${REPOSITORY_NAME}:${tag}"

    echo "${FULL_image_name}"

    # Build, tag, and push the Docker image

    echo "Building Docker image ${image_name}..."

    #ECR Issue Discussion - https://github.com/aws/aws-cdk/issues/31549
    docker build -t "${image_name}" --provenance=false "${build_context}"

    echo "tagging image as ${FULL_image_name}..."
    docker tag "${image_name}" "${FULL_image_name}"

    # Login to ECR
    echo "Logging into Amazon ECR..."
    aws ecr get-login-password | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query 'Account' --output text).dkr.ecr.${REGION}.amazonaws.com

    echo "Checking if repository ${REPOSITORY_NAME} exists in ECR..."

    # Use aws CLI to check if the repository exists
    if aws ecr describe-repositories \
        --repository-names "${REPOSITORY_NAME}" \
        --region "${REGION}" \
        --profile "${AWS_PROFILE}" >/dev/null 2>&1; then
        echo "Repository ${REPOSITORY_NAME} already exists."
    else
        echo "Repository ${REPOSITORY_NAME} does not exist in ECR."
    fi

    echo "Pushing image to ECR..."
    docker push "${FULL_image_name}"
}

# If the script is being run directly (not sourced), call the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    build_and_push_docker_images_to_ecr "$@"
fi
