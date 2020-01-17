## Setup

```
$ yarn install

# In d2-api folder, run: yarn build && cd build && yarn link

$ yarn link d2-api
```

## Development

Start development server:

```
$ export PORT=8081
$ export REACT_APP_DHIS2_BASE_URL="https://play.dhis2.org/2.32"
$ yarn start
```

## Tests

Setup (only when config object changes):

```
$ yarn generate-test-fixtures 'http://admin:PASSWORD@SERVER:PORT'
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

## Build

```
$ yarn build-webapp
```

## i18n

### Update an existing language

```
$ yarn update-po
# ... add/edit translations in po files ...
$ yarn localize
```

### Create a new language

```
$ cp i18n/en.pot i18n/es.po
# ... add translations to i18n/es.po ...
$ yarn localize
```
