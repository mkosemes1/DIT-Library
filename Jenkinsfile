pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = "dit-library"
        DOCKER_BUILDKIT = "1"
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '5'))
    }

    stages {
        stage('Checkout') {
            steps {
                echo "Récupération du code depuis GitHub"
                checkout scm
            }
        }

        stage('Lint & Vérifications') {
            parallel {
                stage('Backend - vérification syntaxe Python') {
                    steps {
                        sh '''
                            for service in books-service users-service loans-service; do
                                echo "-- Vérification $service --"
                                python3 -m py_compile backend/$service/app/*.py
                            done
                        '''
                    }
                }
                stage('Frontend - installation & build') {
                    steps {
                        dir('frontend') {
                            sh 'npm install --prefer-offline --no-audit'
                            sh 'npm run build'
                        }
                    }
                }
            }
        }

        stage('Build des images Docker') {
            steps {
                // Utilisation du cache Docker existant pour aller très vite
                sh 'docker-compose build'
            }
        }

        stage('Tests des microservices') {
            steps {
                sh '''
                    docker-compose up -d postgres
                    sleep 10
                    docker-compose up -d books-service users-service loans-service
                    sleep 15

                    echo "-- Test de santé books-service --"
                    curl -f http://localhost:8001/health

                    echo "-- Test de santé users-service --"
                    curl -f http://localhost:8002/health

                    echo "-- Test de santé loans-service --"
                    curl -f http://localhost:8003/health
                '''
            }
        }

        stage('Déploiement') {
            steps {
                echo "Déploiement automatique avec Docker Compose"
                sh '''
                    docker-compose up -d
                    docker-compose ps
                '''
            }
        }

        stage('Vérification post-déploiement') {
            steps {
                sh '''
                    sleep 10
                    curl -f http://localhost:3000 || (echo "Frontend indisponible" && exit 1)
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Pipeline terminé avec succès — plateforme déployée."
        }
        failure {
            echo "❌ Échec du pipeline — nettoyage des conteneurs."
            sh 'docker-compose down || true'
        }
        // Suppression du docker system prune -f pour conserver le cache précieux !
    }
}
