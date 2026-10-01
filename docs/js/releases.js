(function () {
  var REPO = 'morkeleb/clay';
  var API = 'https://api.github.com/repos/' + REPO;
  var GROUPS = [
    { type: 'feat', title: 'Added' },
    { type: 'fix', title: 'Fixed' },
    { type: 'perf', title: 'Changed' },
    { type: 'docs', title: 'Docs' },
  ];

  function githubUrl(url) {
    try {
      var parsed = new URL(url);
      if (
        parsed.protocol === 'https:' &&
        parsed.hostname === 'github.com' &&
        parsed.pathname.indexOf('/' + REPO) === 0
      ) {
        return parsed.href;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function versionParts(name) {
    return name
      .replace(/^v/, '')
      .split('.')
      .map(function (part) {
        return Number(part);
      });
  }

  function byVersion(a, b) {
    var av = versionParts(a.name);
    var bv = versionParts(b.name);
    for (var i = 0; i < 3; i++) {
      if (av[i] !== bv[i]) return av[i] - bv[i];
    }
    return 0;
  }

  function classify(line) {
    var match = /^(feat|fix|perf|docs)(?:\([^)]+\))?[:!]\s+(.+)$/.exec(line);
    if (!match) return null;
    return { type: match[1], summary: match[2] };
  }

  function getJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error('GitHub returned ' + response.status);
      }
      return response.json();
    });
  }

  function notesBetween(base, head) {
    return getJson(API + '/compare/' + base + '...' + head).then(function (data) {
      var notes = [];
      (data.commits || []).forEach(function (commit) {
        var line = commit.commit.message.split('\n')[0].trim();
        var note = classify(line);
        if (!note) return;
        notes.push({
          type: note.type,
          summary: note.summary,
          url: githubUrl(commit.html_url),
        });
      });
      return {
        notes: notes,
        truncated: (data.total_commits || 0) > (data.commits || []).length,
        identical: data.status === 'identical',
      };
    });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function appendLink(parent, url, text) {
    var safe = githubUrl(url);
    if (!safe) {
      parent.appendChild(document.createTextNode(text));
      return;
    }
    var link = element('a', null, text);
    link.href = safe;
    parent.appendChild(link);
  }

  function renderRelease(container, release) {
    var heading = element('h2');
    appendLink(heading, release.url, release.title);
    if (release.date) {
      heading.appendChild(element('span', 'release-meta', release.date));
    }
    container.appendChild(heading);

    if (release.intro) {
      container.appendChild(element('p', null, release.intro));
    }

    GROUPS.forEach(function (group) {
      var items = release.notes.filter(function (note) {
        return note.type === group.type;
      });
      if (!items.length) return;
      container.appendChild(element('h3', null, group.title));
      var list = element('ul');
      items.forEach(function (item) {
        var li = element('li');
        appendLink(li, item.url, item.summary);
        list.appendChild(li);
      });
      container.appendChild(list);
    });

    if (release.truncated) {
      container.appendChild(
        element('p', null, 'GitHub returned the first page of commits for this range.')
      );
    }
  }

  function showError(container, status) {
    status.remove();
    var note = element('div', 'note');
    note.appendChild(element('strong', null, 'Tags.'));
    note.appendChild(
      document.createTextNode(' The list could not be read from GitHub. ')
    );
    appendLink(note, 'https://github.com/' + REPO + '/tags', 'Version tags');
    note.appendChild(document.createTextNode('.'));
    container.appendChild(note);
  }

  function load() {
    var container = document.getElementById('releases');
    var status = document.getElementById('release-status');
    if (!container || !status) return;

    getJson(API + '/tags?per_page=100')
      .then(function (tags) {
        var versions = (tags || [])
          .filter(function (tag) {
            return /^v\d+\.\d+\.\d+$/.test(tag.name);
          })
          .sort(byVersion);
        if (!versions.length) {
          throw new Error('no version tags');
        }
        return Promise.all(
          versions.map(function (tag) {
            return getJson(API + '/commits/' + tag.name).then(function (commit) {
              return {
                name: tag.name,
                version: tag.name.replace(/^v/, ''),
                sha: commit.sha,
                date: formatDate(commit.commit.committer.date),
                url: 'https://github.com/' + REPO + '/releases/tag/' + tag.name,
              };
            });
          })
        );
      })
      .then(function (versions) {
        var ranges = [];
        versions.forEach(function (version, index) {
          if (index === 0) {
            ranges.push(Promise.resolve({ version: version, range: null }));
            return;
          }
          var previous = versions[index - 1];
          ranges.push(
            notesBetween(previous.name, version.name).then(function (range) {
              return { version: version, range: range };
            })
          );
        });
        var latest = versions[versions.length - 1];
        ranges.push(
          notesBetween(latest.name, 'master').then(function (range) {
            return { version: null, range: range, after: latest.version };
          })
        );
        return Promise.all(ranges);
      })
      .then(function (sections) {
        status.remove();
        var ordered = sections.slice().reverse();
        ordered.forEach(function (section) {
          if (!section.version) {
            if (!section.range || section.range.identical || !section.range.notes.length) {
              return;
            }
            renderRelease(container, {
              title: 'Unreleased',
              url: 'https://github.com/' + REPO + '/compare/v' + section.after + '...master',
              intro: 'On master, after ' + section.after + '.',
              notes: section.range.notes,
              truncated: section.range.truncated,
            });
            return;
          }
          var notes = section.range ? section.range.notes : [];
          renderRelease(container, {
            title: section.version.version,
            url: section.version.url,
            date: section.version.date,
            intro: section.range
              ? ''
              : 'Published baseline. Later versions list the subjects after this tag.',
            notes: notes,
            truncated: section.range ? section.range.truncated : false,
          });
        });
      })
      .catch(function () {
        showError(container, status);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
