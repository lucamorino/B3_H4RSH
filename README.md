# `B3-H4RSH`

Welcome to _B3-H4RSH_, a noise-based networked music system for mobile devices. 

The web application for smartphone browsers on a co-located network interconnects participants’ devices, employing competitive multiplayer mechanics to
structure interdependencies among players and shape the music-making act within a noise-music paradigm. By influencing and responding to one another’s actions, participants collectively diffuse sound throughout the space from their smartphones while competing to achieve the “harshest” sonic outcome – and win.

The sound engine is developed in RNBO (https://rnbo.cycling74.com/).
The web architecture is developed in JavaScript and built on **soundworks**, an “open-source creative coding framework for distributed applications based on web technologies”.

## Links / Resources

- [General Documentation / Tutorials](https://soundworks.dev/)
- [API](https://soundworks.dev/api)
- [Examples](https://github.com/collective-soundworks/soundworks-examples)
- [Issue Tracker](https://github.com/collective-soundworks/soundworks/issues)
- [Working with Max/MSP](https://github.com/collective-soundworks/soundworks-max)

## Soundworks wizard

The soundworks wizard is a interactive command line tool that gives you access to a bunch of high-level routines, such as:

- Create and configure new clients
- Install / uninstall plugins and related libraries
- Find some documentation
- Create environment config files
- etc.

```bash
npx soundworks
```




## Available npm scripts

### `npm run dev`

Launch the application in development mode. Watch file system, compile and/or bundle files on change, and restart the server when needed.

### `npm run build`

Build the application. Compile and bundle the sources without launching the server.

### `npm run start`

Launch the server without building the application. Basically a shortcut for `node ./.build/server/index.js`.

### `npm run watch [name]` _(node clients only)_

Launch the `[name]` client and restart when the sources are updated. 

For example, if you are developing an application with a Node client, you should run the `dev` script (to build the sources and start the server) in one terminal:

```bash
npm run dev
```

And launch and watch the node client(s) (e.g. called `thing`) in another terminal. The client will automatically restart when the sources are re-compiled by the `dev` script:

```bash
npm run watch thing
```

## Configuring the build

Browser clients are compiled using [swc](https://swc.rs/). By default, builds are made with the `es2022` target which supports a number of modern JavaScript features.

If you need to support older browsers, you can configure the build in the `.swcrc` file (cf. [https://swc.rs/docs/configuration/swcrc](https://swc.rs/docs/configuration/swcrc))

## Environment variables

### `ENV`

Define which environment config file should be used to run the application. Environment config files are located in the `/config` directory and are prefixed with `env-`. 

For example, given the following config files:

```
├─ config
│  ├─ env-default.json
│  └─ env-prod.json   
```

To start the server, the `/config/env-prod.js` configuration file, you should run:

```bash
ENV=prod npm run start
``` 

If no `env` file is found, the application will generate a default config suitable for most development uses.

### `PORT`

Override the port defined in the config file. 

For example, to launch the server on port `3000`, whatever the `port` value defined in the default configuration file, you should run:

```bash
PORT=3000 npm run start
```

## Emulating clients

In development, it can be convenient to emulate several clients in the same browser window or the same terminal

### Browsers clients

To emulate several browser clients in the same window, just append the query parameter `?emulate=[num_clients]` to the URL. For example, to launch 10 clients side by side in the same window, you should run:

```
http://127.0.0.1:8000?emulate=10
```

### Node clients

To emulate several node clients in the same terminal, you can use the `EMULATE=[num_clients]` environment variable. For example, to launch 10 clients in parallel from the same terminal, you should run:

```bash
EMULATE=10 npm run watch thing
```

## Credits

[soundworks](https://soundworks.dev) is developed by the ISMM team at Ircam

## License

[BSD-3-Clause](./LICENSE)
