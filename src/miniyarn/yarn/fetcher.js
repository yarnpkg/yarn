import {S_IFDIR, S_IFREG} from 'fs';

import {ArchiveFetcher} from 'miniyarn/fetchers/ArchiveFetcher';
import {BaseMultiFetcher} from 'miniyarn/fetchers/BaseMultiFetcher';
import {CacheFetcher} from 'miniyarn/fetchers/CacheFetcher';
import {DirectoryFetcher} from 'miniyarn/fetchers/DirectoryFetcher';
import {FsEntryFetcher} from 'miniyarn/fetchers/FsEntryFetcher';
import {GitFetcher} from 'miniyarn/fetchers/GitFetcher';
import {HttpFetcher} from 'miniyarn/fetchers/HttpFetcher';
import {LegacyMirrorFetcher} from 'miniyarn/fetchers/LegacyMirrorFetcher';
import {MirrorFetcher} from 'miniyarn/fetchers/MirrorFetcher';
import {UnpackFetcher} from 'miniyarn/fetchers/UnpackFetcher';
import {YarnFetcher} from 'miniyarn/fetchers/YarnFetcher';

// HttpFetcher          | Fetch a tarball from the internet
// YarnFetcher          | Fetch a tarball from the registry
// ArchiveFetcher       | Normalizes an archive, and returns its package meta
// DirectoryFetcher     | Normalizes a directory, and returns its package meta
// GitFetcher           | Clone a repository & generates a tarball
// MirrorFetcher.Save   | Tarball the input directory, store it in the mirror
// MirrorFetcher.Load   | Returns the stored tarball if possible
// CacheFetcher         | Returns the directory from the cache if possible
// UnpackFetcher        | Takes a tarball & extract it
// FsEntryFetcher       | Loosely validate a FS path, then return it

// prettier-ignore

export let fetcher = new BaseMultiFetcher()

  .add(new MirrorFetcher.Save()
//   .add(new LegacyMirrorFetcher.Save()

      .add(new CacheFetcher()
        .add(new UnpackFetcher()

          .add(new MirrorFetcher.Load()
            .add(new LegacyMirrorFetcher.Load()

              .add(new ArchiveFetcher()
                .add(new GitFetcher())
              )

              .add(new ArchiveFetcher({virtualPath: `/package`})
                .add(new HttpFetcher({pathPattern: `*+(.tar.gz|.tgz)`}))
                .add(new YarnFetcher()),
              )

            ),
          ),

        ),
      ),

//  ),
  )

  .add(new MirrorFetcher.Save()
    .add(new LegacyMirrorFetcher.Save()

      .add(new UnpackFetcher()

        .add(new MirrorFetcher.Load()
          .add(new LegacyMirrorFetcher.Load()

            .add(new ArchiveFetcher({virtualPath: `/package`})
              .add(new FsEntryFetcher({pathPattern: `*+(.tar.gz|.tgz)`, type: S_IFREG})),
            )

          )
        )

      )

    )
  )

  .add(new DirectoryFetcher()
    .add(new FsEntryFetcher({type: S_IFDIR}))
  )

;
