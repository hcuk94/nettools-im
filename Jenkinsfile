pipeline {
    agent { 
        label 'docker-agent-jekyll'
    }
    stages {
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

                    # IMPORTANT: do not overwrite tracked _config.yml in the workspace.
                    # For staging, merge configs at build-time instead.
                    if [ "${BRANCH_NAME}" = "staging" ]; then
                      jekyll build --config _config.yml,_config.staging.yml
                    else
                      jekyll build
                    fi
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
                        # NOTE: rsync options must appear before the source/dest args.
                        # When --delete-after is placed after the destination, rsync treats
                        # it as a file argument and no deletion occurs.
                        rsync -rvz --delete-after -e "ssh -o StrictHostKeyChecking=no -o IdentityFile=${SSH_KEY}" . cicduser@${DEPLOY_SERVER}:${DEPLOY_PATH}
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
                        # NOTE: rsync options must appear before the source/dest args.
                        # When --delete-after is placed after the destination, rsync treats
                        # it as a file argument and no deletion occurs.
                        rsync -rvz --delete-after -e "ssh -o StrictHostKeyChecking=no -o IdentityFile=${SSH_KEY}" . cicduser@${DEPLOY_SERVER}:${DEPLOY_PATH}
                    '''
                }
            }
        }
    }
    post {
        always { cleanWs() }
    }
}