## Setup

```
$ yarn install
```

## Build

Customize main configuration file `public/app-config.json` and then build the ZIP package:

```
$ yarn build-webapp
```

## Development

Start a d2 docker instance:

```
$ d2-docker start eyeseetea/dhis2-data:2.32-samaritans --port=8080 -d
```

Start the development server pointing to that DHIS2 instance:

```
$ PORT=8081 REACT_APP_DHIS2_BASE_URL="http://localhost:8080" REACT_APP_TRACK_RERENDERS=1 yarn start
```

To avoid browser cross-domain iframes error, instruct the server proxy requests:

```
PORT=8081 REACT_APP_PROXY_TARGET=http://localhost:8080 REACT_APP_PROXY_AUTH='admin:PASSWORD' REACT_APP_DHIS2_BASE_URL=http://localhost:8081/dhis2 yarn start
```

## Using iframes

Use use iframes to embed the DHIS2 data entry app. The typical approach -a development
server and DHIS2 instance working on different ports- will not work due to cross-domain security
issues. To circumvent this problem, we need to setup a web server to centralize all requests in the
same host and port. An example using nginx:

```
# /etc/nginx/nginx.conf
http {
    ....

    server {
        listen 8001;
        server_name localhost;

        location / {
            proxy_pass   http://localhost:8080;
        }

        location /webapp/ {
            proxy_pass   http://localhost:8081;
        }
    }
}
```

Make sure you have CORS enabled in DHIS2 for http://localhost/8001, and finally start the development server like this:

```
$ PORT=8081 REACT_APP_DHIS2_BASE_URL="http://localhost:8001/" PUBLIC_URL=webapp yarn start
```

The app will be now be accessible at `http://localhost:8001/webapp`.

## Tests

Setup (only when config object changes):

```
$ yarn generate-test-fixtures 'http://admin:PASSWORD@SERVER'
```

Unit testing:

```
$ yarn test
```

Run integration tests locally:

```
$ export CYPRESS_DHIS2_AUTH='admin:district'
$ export CYPRESS_EXTERNAL_API="http://localhost:8080"
$ export CYPRESS_ROOT_URL=http://localhost:8081

$ yarn cy:e2e:open # interactive UI
$ [xvfb-run] yarn cy:e2e:run # non-interactive UI
```

For cypress tests to work in Travis CI, you will have to create an environment variable CYPRESS_DHIS2_AUTH (Settings -> Environment Variables) with the authentication used in your testing DHIS2 instance.
