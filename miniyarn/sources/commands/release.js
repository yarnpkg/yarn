export default concierge => concierge

    .command(`release [-v,--version VERSION]`)
    .describe(`Release a new version of the package`)

    .action(async (args) => {

        if (args.version)
            await concierge.run(args.argv0, [ `version`, `--`, args.version ]);
        else
            await concierge.run(args.argv0, [ `version`, `-i` ]);

        return await concierge.run(args.argv0, [ `publish` ]);

    })

;
