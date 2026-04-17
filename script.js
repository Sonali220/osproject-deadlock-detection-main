let nodes = {}, edges = [];

// SERIAL FIX
function getNextId(type) {
    let prefix = type === "process" ? "P" : "R";
    let used = [];

    for (let key in nodes) {
        if (key.startsWith(prefix)) {
            used.push(parseInt(key.slice(1)));
        }
    }

    used.sort((a,b)=>a-b);

    for (let i=1; i<=used.length; i++) {
        if (used[i-1] !== i) return prefix + i;
    }

    return prefix + (used.length + 1);
}

// ADD NODE
function addNode(type) {
    let div = document.createElement("div");
    div.className = "node " + type;

    let id = getNextId(type);
    div.innerText = id;

    div.style.left = Math.random()*600 + "px";
    div.style.top = Math.random()*400 + "px";

    div.ondblclick = () => deleteNode(id, div);

    makeDraggable(div);

    document.getElementById("graph").appendChild(div);
    nodes[id] = div;
}

// DELETE
function deleteNode(id, el) {
    el.remove();
    delete nodes[id];
    edges = edges.filter(e => e.from !== id && e.to !== id);
    redrawEdges();
}

// ADD EDGE
function addEdge() {
    let from = document.getElementById("from").value.trim();
    let to = document.getElementById("to").value.trim();

    if(!nodes[from] || !nodes[to]) {
        alert("Invalid nodes!");
        return;
    }

    edges.push({from, to});
    redrawEdges();
}

// DRAW CURVED EDGES
function redrawEdges() {
    let svg = document.getElementById("lines");
    Array.from(svg.children).forEach(child => {
        if (child.tagName.toLowerCase() === "path") {
            child.remove();
        }
    });

    edges.forEach((e) => {
        let x1 = nodes[e.from].offsetLeft + 35;
        let y1 = nodes[e.from].offsetTop + 35;
        let x2 = nodes[e.to].offsetLeft + 35;
        let y2 = nodes[e.to].offsetTop + 35;

        let dx = (x1 + x2) / 2;
        let dy = (y1 + y2) / 2 - 60;

        let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let color = e.from.startsWith("P") ? "blue" : "red";

        path.setAttribute("d", `M ${x1} ${y1} Q ${dx} ${dy} ${x2} ${y2}`);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color);
        path.setAttribute("color", color);
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("marker-end", "url(#arrowhead)");

        svg.appendChild(path);
    });
}

// 🔥 CORRECT DEADLOCK DETECTION
function detectDeadlock() {
    let graph = {};
    let parent = {};
    let cycle = [];

    // Step 1: Build Wait-For Graph
    edges.forEach(e1 => {
        if(e1.from.startsWith("P") && e1.to.startsWith("R")) {

            edges.forEach(e2 => {
                if(e2.from === e1.to && e2.to.startsWith("P")) {

                    if(!graph[e1.from]) graph[e1.from] = [];
                    graph[e1.from].push(e2.to);
                }
            });

        }
    });

    let visited = {}, recStack = {};

    function dfs(node) {
        visited[node] = true;
        recStack[node] = true;

        for(let nei of (graph[node] || [])) {

            if(!visited[nei]) {
                parent[nei] = node;
                if(dfs(nei)) return true;
            }

            else if(recStack[nei]) {
                // 🔥 Build cycle path
                cycle = [nei];
                let cur = node;

                while(cur !== nei) {
                    cycle.push(cur);
                    cur = parent[cur];
                }

                cycle.push(nei);
                cycle.reverse();
                return true;
            }
        }

        recStack[node] = false;
        return false;
    }

    // Reset colors
    Object.values(nodes).forEach(n => {
        if(n.classList.contains("process"))
            n.style.background = "green";
    });

    // Run DFS
    for(let node in graph) {
        if(!visited[node]) {
            if(dfs(node)) {

                // 🔥 Highlight deadlock nodes
                cycle.forEach(p => {
                    if(nodes[p]) {
                        nodes[p].style.background = "yellow";
                        nodes[p].style.color = "black";
                    }
                });

                // 🔥 Suggestion
                let suggestion =
                    "Terminate " + cycle[0] + " OR Preempt a resource";

                document.getElementById("result").innerHTML =
                    "🔴 Deadlock Detected!<br>" +
                    "Cycle: " + cycle.join(" → ") + "<br>" +
                    "Suggestion: " + suggestion;

                return;
            }
        }
    }

    document.getElementById("result").innerHTML =
        "🟢 No Deadlock (Safe State)";
}

// CLEAR
function clearGraph(){
    location.reload();
}

// DRAG
function makeDraggable(el){
    let graph = document.getElementById("graph");
    let isDown=false, offsetX=0, offsetY=0;

    el.onmousedown = e=>{
        isDown=true;
        offsetX=e.offsetX;
        offsetY=e.offsetY;
    };

    document.onmousemove = e=>{
        if(!isDown) return;

        let rect = graph.getBoundingClientRect();

        let x = e.clientX - rect.left - offsetX;
        let y = e.clientY - rect.top - offsetY;

        x = Math.max(0, Math.min(x, graph.clientWidth - el.offsetWidth));
        y = Math.max(0, Math.min(y, graph.clientHeight - el.offsetHeight));

        el.style.left = x+"px";
        el.style.top = y+"px";

        redrawEdges();
    };

    document.onmouseup = ()=> isDown=false;
}