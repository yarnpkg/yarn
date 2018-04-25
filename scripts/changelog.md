<% commits.forEach(function (commit) { %>
* __<%= commit.title %>__

    [<%= commit.authorName %>](mailto:<%= commit.authorEmail %>) - <%= commit.committerDate %>
<% }) %>
