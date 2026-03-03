repomix:
    repomix --copy --ignore ".opencode/**,packages/sdk/src/gen/**,packages/sdk/openapi.json,packages/web/public/**,packages/server/drizzle/**"
    rm repomix-output.md 

docker-build:
    docker build -t piclaw .

docker-run:
    docker run --rm -it --init -p 3000:3000 -v "${HOME}/.pi:/home/node/.pi" piclaw
