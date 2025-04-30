const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();
const db = new sqlite3.Database("./database.db");

app.use(express.json());
app.use(cors());

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS graphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_directed INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT,
      graph_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      PRIMARY KEY (id, graph_id),
      FOREIGN KEY (graph_id) REFERENCES graphs(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      graph_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      FOREIGN KEY (graph_id) REFERENCES graphs(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS user_graphs (
      user_id INTEGER,
      graph_id INTEGER,
      PRIMARY KEY (user_id, graph_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (graph_id) REFERENCES graphs(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS binary_tree_nodes (
      id TEXT,
      binary_tree_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      parent_id TEXT,  -- Reference to the parent node
      left_child_id TEXT,  -- Reference to left child node
      right_child_id TEXT,  -- Reference to right child node
      PRIMARY KEY (id, binary_tree_id),
      FOREIGN KEY (binary_tree_id) REFERENCES binary_trees(id),
      FOREIGN KEY (parent_id) REFERENCES binary_tree_nodes(id),
      FOREIGN KEY (left_child_id) REFERENCES binary_tree_nodes(id),
      FOREIGN KEY (right_child_id) REFERENCES binary_tree_nodes(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS user_binary (
      user_id INTEGER,
      binary_tree_id INTEGER,
      PRIMARY KEY (user_id, binary_tree_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (binary_tree_id) REFERENCES binary_trees(id)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS binary_trees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `);

  // Helper to insert graph if it doesn't exist
  function insertGraphIfNotExists(name, is_directed, nodes, edges) {
    db.get("SELECT id FROM graphs WHERE name = ?", [name], (err, existingGraph) => {
      if (err) return console.error(`Error checking ${name}:`, err);
      if (existingGraph) {
        console.log(`${name} already exists, skipping insert.`);
        return;
      }

      db.run(
        "INSERT INTO graphs (name, is_directed) VALUES (?, ?)",
        [name, is_directed],
        function (err) {
          if (err) return console.error(`Error inserting ${name}:`, err);
          const graphId = this.lastID;

          nodes.forEach(({ id, label }) => {
            db.run(
              "INSERT OR IGNORE INTO graph_nodes (id, graph_id, label) VALUES (?, ?, ?)",
              [id, graphId, label]
            );
          });

          edges.forEach(({ source, target }) => {
            db.run(
              "INSERT INTO graph_edges (graph_id, source, target) VALUES (?, ?, ?)",
              [graphId, source, target]
            );
          });

          console.log(`${name} inserted.`);
        }
      );
    });
  }

  // Helper to insert binary tree if it doesn't exist
  // Helper to insert binary tree if it doesn't exist
function insertBinaryTreeIfNotExists(name, nodes) {
  // Check if binary tree already exists by name
  db.get("SELECT id FROM binary_trees WHERE name = ?", [name], function(err, existingTree) {
    if (err) {
      console.error(`Error checking if binary tree exists:`, err);
      return;
    }

    // If the binary tree already exists, skip insertion
    if (existingTree) {
      console.log(`Binary tree "${name}" already exists, skipping insert.`);
      return;
    }

    // Insert the new binary tree if it doesn't exist
    db.run("INSERT INTO binary_trees (name) VALUES (?)", [name], function(err) {
      if (err) {
        console.error(`Error inserting binary tree "${name}":`, err);
        return;
      }

      const binaryTreeId = this.lastID;
      console.log(`Binary tree "${name}" inserted with ID ${binaryTreeId}.`);

      // Insert nodes into the binary tree
      const insertNode = db.prepare("INSERT OR IGNORE INTO binary_tree_nodes (id, binary_tree_id, label, parent_id, left_child_id, right_child_id) VALUES (?, ?, ?, ?, ?, ?)");
      
      nodes.forEach(({ id, label, parentId, leftChildId, rightChildId }) => {
        insertNode.run(id, binaryTreeId, label, parentId, leftChildId, rightChildId);
      });

      insertNode.finalize();
    });
  });
}

insertBinaryTreeIfNotExists("Binary Tree Example", [
  { id: 1, label: 5, parentId: null, leftChildId: 2, rightChildId: 8 },  // Root node
  { id: 2, label: 2, parentId: 1, leftChildId: null, rightChildId: 3 },  // Left child of root
  { id: 3, label: 3, parentId: 2, leftChildId: null, rightChildId: null }, // Right child of 2
  { id: 8, label: 8, parentId: 1, leftChildId: 6, rightChildId: 9 },  // Right child of root
  { id: 6, label: 6, parentId: 8, leftChildId: null, rightChildId: null }, // Left child of 8
  { id: 9, label: 9, parentId: 8, leftChildId: null, rightChildId: null }, // Right child of 8
]);


  const commonNodes = ["a", "b", "c", "d", "e", "f"].map(id => ({ id, label: id.toUpperCase() }));

  insertGraphIfNotExists("Directed 1", 1, commonNodes, [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "b", target: "e" },
    { source: "c", target: "e" },
    { source: "d", target: "a" },
    { source: "e", target: "d" },
    { source: "f", target: "c" },
    { source: "f", target: "e" }
  ]);

  insertGraphIfNotExists("Undirected 1", 0, commonNodes, [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "b", target: "d" },
    { source: "c", target: "e" },
    { source: "d", target: "a" },
    { source: "e", target: "d" },
    { source: "f", target: "c" },
    { source: "f", target: "e" }
  ]);

  insertGraphIfNotExists("Directed 2", 1, commonNodes, [
    { source: "a", target: "b" },
    { source: "a", target: "e" },
    { source: "b", target: "c" },
    { source: "b", target: "e" },
    { source: "d", target: "a" },
    { source: "e", target: "d" },
    { source: "e", target: "c" },
    { source: "f", target: "c" },
    { source: "f", target: "e" }
  ]);
});

// User registration
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });

  db.get("SELECT id FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (user) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword], function (err) {
      if (err) return res.status(500).json({ error: "Error registering user" });
      res.status(201).json({ id: this.lastID, name, email });
    });
  });
});

// User login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password" });

    res.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email },
    });
  });
});

// Change password
app.put("/update-password", async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ error: "User ID, old password and new password are required" });
  }

  db.get("SELECT * FROM users WHERE id = ?", [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(401).json({ error: "Old password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    db.run(
      "UPDATE users SET password = ? WHERE id = ?",
      [hashedNewPassword, userId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Error updating password" });
        }
        res.json({ message: "Password updated successfully" });
      }
    );
  });
});

// Update username
app.put("/update-username", (req, res) => {
  const { userId, newName } = req.body;

  if (!userId || !newName) {
    return res.status(400).json({ error: "User ID and new name are required" });
  }

  db.run(
    "UPDATE users SET name = ? WHERE id = ?",
    [newName, userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Error updating username" });
      }
      res.json({ message: "Username updated successfully" });
    }
  );
});

// Update email
app.put("/update-email", (req, res) => {
  const { userId, newEmail } = req.body;

  if (!userId || !newEmail) {
    return res.status(400).json({ error: "User ID and new email are required" });
  }

  db.get("SELECT id FROM users WHERE email = ?", [newEmail], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (existingUser) {
      return res.status(400).json({ error: "Email is already taken" });
    }

    db.run(
      "UPDATE users SET email = ? WHERE id = ?",
      [newEmail, userId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: "Error updating email" });
        }
        res.json({ message: "Email updated successfully" });
      }
    );
  });
});

// Get user profile
app.get("/get-profile/:userId", (req, res) => {
  const { userId } = req.params;

  db.get("SELECT id, name, email FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });
});

// Delete user profile
app.delete("/delete-profile", (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: "User ID and password are required" });
  }

  db.get("SELECT * FROM users WHERE id = ?", [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Compare password with the one stored in the database
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // If the password matches, delete the user from the database
    db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
      if (err) {
        return res.status(500).json({ error: "Error deleting user" });
      }
      res.json({ message: "User profile deleted successfully" });
    });
  });
});

// Get details of a specific binary tree by its ID
app.get("/get-binary-tree/:binaryTreeId", (req, res) => {
  const { binaryTreeId } = req.params; // Get binaryTreeId from route parameters

  // Fetch the binary tree info
  db.get("SELECT name FROM binary_trees WHERE id = ?", [binaryTreeId], (err, binaryTree) => {
    if (err) return res.status(500).json({ error: "Error fetching binary tree info" });
    if (!binaryTree) return res.status(404).json({ error: "Binary tree not found" });

    // Fetch the nodes of the binary tree
    db.all(
      "SELECT id, label, parent_id, left_child_id, right_child_id FROM binary_tree_nodes WHERE binary_tree_id = ? ORDER BY id",
      [binaryTreeId],
      (err, nodes) => {
        if (err) return res.status(500).json({ error: "Error fetching binary tree nodes" });

        // Convert the flat node structure to a hierarchical structure
        const nodeMap = {};

        // Initialize all nodes with id and label
        nodes.forEach(node => {
          nodeMap[node.id] = {
            name: node.label, // Use 'name' for the label
            children: [] // Initialize the 'children' property as an empty array
          };
        });

        // Build the hierarchy by linking children to their parent
        nodes.forEach(node => {
          const { id, parent_id, left_child_id, right_child_id } = node;
          const treeNode = nodeMap[id];

          // Assign left and right children
          if (left_child_id && nodeMap[left_child_id]) {
            treeNode.children.push(nodeMap[left_child_id]);
          }

          if (right_child_id && nodeMap[right_child_id]) {
            treeNode.children.push(nodeMap[right_child_id] || null);
          }

          // Assign parent if not root
          // if (parent_id) {
          //   if (!nodeMap[parent_id].children) nodeMap[parent_id].children = [];
          //   nodeMap[parent_id].children.push(treeNode);
          // }
        });

        // Find the root (node with no parent_id)
        const root = nodes.find(node => !node.parent_id);

        // Return the root node as a hierarchical structure
        res.json({
          name: binaryTree.name,
          elements: nodeMap[root.id], // D3 expects the root node structure
        });
      }
    );
  });
});


// Get graph data
app.get("/get-graph/:graphId", (req, res) => {
  const { graphId } = req.params;
  const elements = [];

  db.get("SELECT is_directed FROM graphs WHERE id = ?", [graphId], (err, graph) => {
    if (err) return res.status(500).json({ error: "Error fetching graph info" });
    if (!graph) return res.status(404).json({ error: "Graph not found" });

    db.all("SELECT id, label FROM graph_nodes WHERE graph_id = ? ORDER BY id", [graphId], (err, nodes) => {
      if (err) return res.status(500).json({ error: "Error fetching nodes" });

      nodes.forEach(node => {
        elements.push({ data: { id: node.id, label: node.label } });
      });

      db.all("SELECT source, target FROM graph_edges WHERE graph_id = ? ORDER BY id", [graphId], (err, edges) => {
        if (err) return res.status(500).json({ error: "Error fetching edges" });

        edges.forEach(edge => {
          elements.push({ data: { source: edge.source, target: edge.target } });
        });

        res.json({ elements, is_directed: Boolean(graph.is_directed) });
      });
    });
  });
});

// Get all binary trees for a specific user or all available binary trees
app.get("/get-binary-trees", (req, res) => {
  const userId = req.query.userId; // Retrieve userId from query parameters

  if (userId) {
    // Fetch binary trees assigned to the user and default binary trees
    db.all(
      `
        SELECT DISTINCT bt.id, bt.name
        FROM binary_trees bt
        LEFT JOIN user_binary ub ON bt.id = ub.binary_tree_id
        WHERE ub.user_id = ? OR ub.user_id IS NULL
        ORDER BY bt.id
      `,
      [userId],
      (err, binaryTrees) => {
        if (err) return res.status(500).json({ error: "Error fetching binary trees" });
        res.json(binaryTrees);
      }
    );
  } else {
    // Fetch all binary trees (for users with no binary tree assignments)
    db.all(
      `
        SELECT id, name
        FROM binary_trees
        WHERE id NOT IN (SELECT binary_tree_id FROM user_binary)
        ORDER BY id
      `,
      (err, binaryTrees) => {
        if (err) return res.status(500).json({ error: "Error fetching binary trees" });
        res.json(binaryTrees);
      }
    );
  }
});

// Get all graph names and IDs
app.get("/get-graphs", (req, res) => {
  const userId = req.query.userId; // Retrieve userId from query parameters

  if (userId) {
    // Fetch graphs assigned to the user and default graphs
    db.all(
      `
        SELECT DISTINCT g.id, g.name 
        FROM graphs g
        LEFT JOIN user_graphs ug ON g.id = ug.graph_id
        WHERE ug.user_id = ? OR ug.user_id IS NULL
        ORDER BY g.id
      `,
      [userId],
      (err, graphs) => {
        if (err) return res.status(500).json({ error: "Error fetching graphs" });
        res.json(graphs);
      }
    );
  } else {
    // Fetch default graphs only
    db.all(
      `
        SELECT id, name 
        FROM graphs 
        WHERE id NOT IN (SELECT graph_id FROM user_graphs)
        ORDER BY id
      `,
      (err, graphs) => {
        if (err) return res.status(500).json({ error: "Error fetching graphs" });
        res.json(graphs);
      }
    );
  }
});

app.post("/add-binary-tree", (req, res) => {
  const { name, nodes = [], user_id } = req.body;

  // Validate the input
  if (!name || !Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: "Binary tree name and nodes are required" });
  }

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required to assign the binary tree" });
  }

  // Insert the binary tree into the binary_trees table
  db.run("INSERT INTO binary_trees (name) VALUES (?)", [name], function (err) {
    if (err) {
      return res.status(500).json({ error: "Error inserting binary tree" });
    }

    const binaryTreeId = this.lastID;

    // Insert nodes into the binary_tree_nodes table
    const insertNode = db.prepare(
      "INSERT INTO binary_tree_nodes (id, binary_tree_id, label, parent_id, left_child_id, right_child_id) VALUES (?, ?, ?, ?, ?, ?)"
    );

    nodes.forEach(({ id, label, parentId, leftChildId, rightChildId }) => {
      insertNode.run(id, binaryTreeId, label, parentId, leftChildId, rightChildId);
    });
    insertNode.finalize();

    // Assign the binary tree to the user in the user_binary table
    db.run("INSERT INTO user_binary (user_id, binary_tree_id) VALUES (?, ?)", [user_id, binaryTreeId], (err) => {
      if (err) {
        return res.status(500).json({ error: "Error assigning binary tree to user" });
      }

      res.status(201).json({
        id: binaryTreeId,
        name,
        user_id,
        message: "Binary tree created and assigned successfully",
      });
    });
  });
});


// Add new graph
app.post("/add-graph", (req, res) => {
  const { name, is_directed = 1, nodes = [], edges = [], user_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Graph name is required" });
  }

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required to assign the graph" });
  }

  db.run("INSERT INTO graphs (name, is_directed) VALUES (?, ?)", [name, is_directed], function (err) {
    if (err) {
      return res.status(500).json({ error: "Error inserting graph" });
    }

    const graphId = this.lastID;

    // Insert nodes into the graph
    const insertNode = db.prepare("INSERT INTO graph_nodes (id, graph_id, label) VALUES (?, ?, ?)");
    nodes.forEach(({ id, label }) => {
      insertNode.run(id, graphId, label);
    });
    insertNode.finalize();

    // Insert edges into the graph
    const insertEdge = db.prepare("INSERT INTO graph_edges (graph_id, source, target) VALUES (?, ?, ?)");
    edges.forEach(({ source, target }) => {
      insertEdge.run(graphId, source, target);
    });
    insertEdge.finalize();

    // Assign the graph to the user in the user_graphs table
    db.run("INSERT INTO user_graphs (user_id, graph_id) VALUES (?, ?)", [user_id, graphId], (err) => {
      if (err) {
        return res.status(500).json({ error: "Error assigning graph to user" });
      }

      res.status(201).json({
        id: graphId,
        name,
        is_directed,
        user_id,
        message: "Graph created and assigned successfully",
      });
    });
  });
});

// // Add a binary tree for a specific user
// app.post("/add-binary-tree", (req, res) => {
//   const { name, nodes, user_id } = req.body;

//   if (!name || !nodes || !Array.isArray(nodes) || nodes.length === 0) {
//     return res.status(400).json({ error: "Binary tree name and nodes are required" });
//   }

//   if (!user_id) {
//     return res.status(400).json({ error: "User ID is required to assign the binary tree" });
//   }

//   // Convert nodes into a hierarchical format that can be processed by D3
//   const nodeMap = {};

//   // Initialize nodes with id and label
//   nodes.forEach(({ id, label }) => {
//     nodeMap[id] = {
//       id,
//       label,
//       children: []
//     };
//   });

//   // Build the hierarchy
//   nodes.forEach(({ id, parentId, leftChildId, rightChildId }) => {
//     const node = nodeMap[id];

//     // Assign left and right children if any
//     if (leftChildId && nodeMap[leftChildId]) {
//       node.children.push(nodeMap[leftChildId]);
//     }

//     if (rightChildId && nodeMap[rightChildId]) {
//       node.children.push(nodeMap[rightChildId]);
//     }

//     // Assign parent if not the root
//     if (parentId && nodeMap[parentId]) {
//       nodeMap[parentId].children.push(node);
//     }
//   });

//   // Find the root node (without parentId)
//   const rootNode = nodes.find(({ parentId }) => parentId === null);

//   insertBinaryTreeIfNotExists(name, nodeMap[rootNode.id], user_id);

//   res.status(201).json({ message: "Binary tree created and assigned successfully" });
// });


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
