// Declarative Pipeline for building Node.js application for a Pull Request.
pipeline {
    // Defines the execution environment. Using 'agent any' to ensure an agent is available.
    agent any

    stages {
        // Stage 1: Checkout the code (Relies on the initial SCM checkout done by Jenkins)
        stage('Source Checkout') {
            steps {
                echo "Workspace already populated by the initial SCM checkout. Proceeding."
            }
        }

        // Stage 2: Setup Node.js v20 and install pnpm
        stage('Setup Environment and Tools') {
            steps {
                sh '''
                    echo "Ensuring required utilities and Node.js are installed..."
                    sudo apt-get update
                    sudo apt-get install -y curl nodejs

                    # 1. Install Node.js v20 (closest matching the specified version '20.17.0')
                    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                    echo "Node.js version: \$(node -v)"

                    # 2. Install pnpm globally (version 8)
                    npm install -g pnpm@8
                    echo "pnpm version: \$(pnpm -v)"
                '''
            }
        }

        // Stage 3: Install dependencies and build the application
        stage('Install and Build') {
            steps {
                sh 'pnpm install'
                sh 'pnpm run build'
            }
        }
    }
}
