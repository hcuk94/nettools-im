pipeline {
    agent { 
        label 'docker-agent-jekyll'
    }
    stages {
        stage('Apply Staging Config') {
            when { branch 'staging' }
            steps {
                sh '''
                    cp _config.staging.yml _config.yml
                '''
            }
        }
        stage('Update OUI Database') {
            steps {
                sh '''
                    ./scripts/update-oui-db.sh
                '''
            }
        }
        stage('Build') {
            steps {
                sh '''
                    bundle install
                    jekyll build
                '''
            }
        }
        stage('Deploy to Staging') {
            when { branch 'staging' }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: "ssh-key-cicduser", keyFileVariable: 'SSH_KEY'),
                    string(credentialsId: 'servername-www1', variable: 'DEPLOY_SERVER'),
                    string(credentialsId: 'deploypath-nettools-sg', variable: 'DEPLOY_PATH')
                ]) {
                    sh '''
                        cd _site
                        ls -lh
                        rsync -rvz -e "ssh -o StrictHostKeyChecking=no -o IdentityFile=${SSH_KEY}" * cicduser@${DEPLOY_SERVER}:${DEPLOY_PATH}
                    '''
                }
            }
        }
        stage('Deploy to Production') {
            when { branch 'main' }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: "ssh-key-cicduser", keyFileVariable: 'SSH_KEY'),
                    string(credentialsId: 'servername-www1', variable: 'DEPLOY_SERVER'),
                    string(credentialsId: 'deploypath-nettools', variable: 'DEPLOY_PATH')
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