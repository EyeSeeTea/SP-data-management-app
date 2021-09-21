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
$ export CYPRESS_EXTERNAL_API="http://localhost:8081/dhis2"
$ export CYPRESS_ROOT_URL=http://localhost:8081

$ yarn cy:e2e:open # interactive UI
$ yarn cy:e2e:run # non-interactive UI
```

For cypress tests to work in Travis CI, you will have to create the environment variable *CYPRESS_DHIS2_AUTH* (Settings -> Environment Variables) with the authentication used in your testing DHIS2 instance.
