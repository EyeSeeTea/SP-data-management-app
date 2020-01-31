## Setup

```
$ yarn install
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

## Build

```
$ yarn build-webapp
```

## Utils

Create users for testing. Prepare a `users.txt` file with the users info, one field per line:

```
Name1
Email1
Role1
Name2
Email2
Role2
```

And now run the script for a specific DHIS2 instance:

```
yarn create-test-users users.txt 'http://admin:PASSWORD@localhost:8080'
```
