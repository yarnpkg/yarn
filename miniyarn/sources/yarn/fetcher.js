import { ArchiveFetcher } from 'miniyarn/fetchers/ArchiveFetcher';
import { CacheFetcher }   from 'miniyarn/fetchers/CacheFetcher';
import { FileFetcher }    from 'miniyarn/fetchers/FileFetcher';
import { GitFetcher }     from 'miniyarn/fetchers/GitFetcher';
import { HttpFetcher }    from 'miniyarn/fetchers/HttpFetcher';
import { MirrorFetcher }  from 'miniyarn/fetchers/MirrorFetcher';
import { UnpackFetcher }  from 'miniyarn/fetchers/UnpackFetcher';
import { YarnFetcher }    from 'miniyarn/fetchers/YarnFetcher';

export let fetcher = new MirrorFetcher.Save()

    .add(new CacheFetcher()

        .add(new UnpackFetcher()

            .add(new MirrorFetcher.Load()

                .add(new GitFetcher())

                .add(new ArchiveFetcher({ virtualPath: `/package` })

                    .add(new HttpFetcher({ pathPattern: `*+(.tar.gz|.tgz)` }))

                    .add(new YarnFetcher())

                )

            )

        )

    )

    .add(new UnpackFetcher()

        .add(new ArchiveFetcher({ virtualPath: `/package` })

            .add(new FileFetcher({ pathPattern: `*+(.tar.gz|.tgz)` }))

        )

    )

;
