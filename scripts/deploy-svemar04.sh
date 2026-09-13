#!/bin/sh
set -eu
remote=svemar@svemar04.local
ssh "$remote" 'mkdir -p "$HOME/MyApps/gym-react-app/source" "$HOME/MyApps/gym-react-app/data"'
rsync -az --delete --exclude=node_modules --exclude=.git --exclude=.env --exclude='.env.*' --exclude=.gradle --exclude=build --exclude=dist --exclude=server/dist ./ "$remote:MyApps/gym-react-app/source/"
ssh "$remote" 'sh -s' <<'REMOTE'
set -eu
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"
cd "$HOME/MyApps/gym-react-app/source"
docker build -t gym-react-app:latest .
# Back up existing history before replacing the application container.
if [ -f ../data/workouts.json ]; then
    cp ../data/workouts.json "../data/workouts.$(date +%Y%m%d-%H%M%S).json"
fi
if docker container inspect gym-react-app >/dev/null 2>&1; then
    docker stop gym-react-app
    docker rm gym-react-app
fi
docker run -d --name gym-react-app --restart unless-stopped \
    -p 5004:3001 -e TZ=Europe/Prague \
    -v "$HOME/MyApps/gym-react-app/data:/app/data" gym-react-app:latest
for attempt in $(seq 1 30); do
    status=$(docker inspect --format '{{.State.Health.Status}}' gym-react-app)
    if [ "$status" = healthy ]; then
        echo "Deployed: http://svemar04.local:5004"
        exit 0
    fi
    if [ "$status" = unhealthy ]; then break; fi
    sleep 2
done
docker logs --tail 50 gym-react-app
exit 1
REMOTE
