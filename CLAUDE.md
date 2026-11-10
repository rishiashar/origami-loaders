# Working on origami-loaders

## Blocked sites: unblock first

If a site you need is blocked by the session's network, unblock it first: add that host to this environment's allowed sites (the owner approves it on a card), then use the site itself. Don't work around a block by reading copies of the page somewhere else.

## Commits are from rishiashar

Every commit is authored and committed as `rishiashar <rishiasharv@gmail.com>`, not as Claude. Before the first commit in a session, set it for the repo:

```sh
git config user.name rishiashar
git config user.email rishiasharv@gmail.com
```

Leave out `Co-Authored-By: Claude` and `Claude-Session` lines in commit messages.

## Releasing

Sessions can't push tags, and the GitHub connection can't start or re-run workflows (it gets a 403). To release, get the version bump and its `CHANGELOG.md` entry onto `main`, then ask rishiashar to click **Run workflow** on the Publish workflow: https://github.com/rishiashar/origami-loaders/actions/workflows/publish.yml. It publishes to npm by trusted publishing, then creates the tag and GitHub release itself. The README's "Releasing" section has the details.
