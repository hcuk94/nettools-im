pipeline {
    agent { label 'docker-agent-jekyll' }
    
    stages {
        stage('Build') {
            steps {
                sh '''
                    bundle install
                    jekyll build
                '''
            }
        }
        stage('Deploy') {
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: "ssh-key-cicduser", keyFileVariable: 'SSH_KEY'),
                    string(credentialsId: 'server-name-www1', variable: 'DEPLOY_SERVER'),
                    string(credentialsId: 'deploy-path-nettools', variable: 'DEPLOY_PATH')
                ]) {
                    sh '''
                        cd _site
                        ls -lh
                        rsync -rvz -e "ssh -o StrictHostKeyChecking=no -o IdentityFile=${SSH_KEY}" * cicduser@${DEPLOY_SERVER}:${DEPLOY_PATH}
                    '''
                }
            }
        }
    }
    post {
        always { cleanWs() }
    }
}