# Docker Setup

To deploy Radar using Docker, follow these steps

1. Download the .env.example and docker-compose-example.yml files from the repository.
2. Rename them to .env and docker-compose.yml respectively

    ``` bash
    cp .env.example .env
    cp docker-compose-example.yml docker-compose.yml
    ```

3. Edit the .env file to configure  your environment
4. Create the data directory

    ``` bash
    mkdir -p ./radar-data
    ```

5. Run docker compose up

    ``` bash
    docker compose up -d
    ```
