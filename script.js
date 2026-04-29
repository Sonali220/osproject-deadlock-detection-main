let nodes = {}, edges = [], cycleEdges = new Set();

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

// DELETE NODE
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

// DRAW EDGES
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
        let key = e.from + '-' + e.to;
        let isCycle = cycleEdges.has(key);

        path.setAttribute("d", `M ${x1} ${y1} Q ${dx} ${dy} ${x2} ${y2}`);
        path.setAttribute("fill", "none");
        path.setAttribute("class", isCycle ? "cycle-edge" : "graph-edge");
        path.setAttribute("color", isCycle ? "#ff2f2f" : "#111");
        path.setAttribute("marker-end", "url(#arrowhead)");

        svg.appendChild(path);
    });
}

// 🔥 DEADLOCK DETECTION + SUGGESTIONS
function detectDeadlock() {
    let graph = {};
    let parent = {};
    let cycle = [];

    // Build Wait-For Graph
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

    // Reset inline node styling so CSS can render process/resource defaults properly
    Object.values(nodes).forEach(n => {
        n.style.background = "";
        n.style.color = "";
    });

    // Run DFS
    for(let node in graph) {
        if(!visited[node]) {
            if(dfs(node)) {

                // Build the full alternating P-R cycle path from the actual edge list
                let fullCycle = [];
                for (let i = 0; i < cycle.length - 1; i++) {
                    let fromProcess = cycle[i];
                    let toProcess = cycle[i + 1];

                    edges.forEach(e1 => {
                        if (e1.from === fromProcess && e1.to.startsWith("R")) {
                            edges.forEach(e2 => {
                                if (e2.from === e1.to && e2.to === toProcess) {
                                    fullCycle.push(fromProcess);
                                    fullCycle.push(e1.to);
                                }
                            });
                        }
                    });
                }

                if (fullCycle.length > 0) {
                    fullCycle.push(fullCycle[0]);
                } else {
                    fullCycle = [...cycle, cycle[0]];
                }

                cycleEdges.clear();
                for (let i = 0; i < fullCycle.length - 1; i++) {
                    cycleEdges.add(fullCycle[i] + '-' + fullCycle[i + 1]);
                }
                redrawEdges();

                // 🔥 IMPROVED SUGGESTIONS
                // 🔥 FINAL WORKING SUGGESTION LOGIC

                // OUTPUT
                let output = "";

                output += "🔴 <b>Deadlock Detected!</b><br><br>";

                output += "🔁 <b>Cycle Found:</b><br>";
                output += fullCycle.join(" → ") + "<br><br>";

                output += "💡 <b>How to resolve:</b><br>";
                output += "👉 Break ANY one of these:<br><br>";

// Remove edges
for (let i = 0; i < fullCycle.length - 1; i++) {
    output += `• Remove dependency: ${fullCycle[i]} → ${fullCycle[i+1]}<br>`;
}

// Processes (unique only)
let shownP = new Set();
fullCycle.forEach(n => {
    if (n.startsWith("P") && !shownP.has(n)) {
        output += `• OR terminate process <b>${n}</b><br>`;
        shownP.add(n);
    }
});

// Resources (unique only)
let shownR = new Set();
fullCycle.forEach(n => {
    if (n.startsWith("R") && !shownR.has(n)) {
        output += `• OR preempt resource <b>${n}</b><br>`;
        shownR.add(n);
    }
});

output += "<br>✔ Breaking ANY one will remove deadlock";
                output += "<div class='warning-text'>⚠️ Cycle is highlighted in red</div>";
// document.getElementById("result").innerHTML = output;
let resultBox = document.getElementById("result");

if (!resultBox) {
    alert("Result div not found!");
    return;
}

resultBox.innerHTML = output;
                return;
            }
        }
    }

    // No deadlock
    cycleEdges.clear();
    redrawEdges();

    document.getElementById("result").innerHTML =
        "🟢 <b>No Deadlock (Safe State)</b>";
}

// CLEAR
function clearGraph(){
    cycleEdges.clear();
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