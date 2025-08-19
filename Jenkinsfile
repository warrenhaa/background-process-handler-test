pipeline {
  agent any

  stages {
    stage('Checkout') {
      steps {
        git 'https://github.com/5GenCare-Limited/uleeco-background-process-handler.git'
      }
    }
  }

  post {
    always {
      // Send branch name and pull request ID to GitHub Pull Request Builder plugin
      script {
        env.GHPRB_PULL_ID = "${env.CHANGE_ID}"
        env.GHPRB_SOURCE_BRANCH = "${env.CHANGE_BRANCH}"
      }
    }
  }
}

#Test
