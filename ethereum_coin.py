import bpy
import bmesh


def create_ethereum_coin():
    # Clear existing objects
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    # Create coin base
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.1, location=(0, 0, 0))
    coin = bpy.context.active_object
    coin.name = "Coin"

    # Create coin material (silver/metallic)
    coin_mat = bpy.data.materials.new(name="CoinMaterial")
    coin_mat.use_nodes = True
    coin_mat.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.9
    coin_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.2
    coin_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (
        0.7,
        0.7,
        0.7,
        1,
    )
    coin.data.materials.append(coin_mat)

    # Create Ethereum logo
    # The Ethereum logo is a diamond shape with 3 horizontal bars
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.05))
    logo = bpy.context.active_object
    logo.name = "EthereumLogo"

    # Scale down the logo to be smaller than in the reference
    logo.scale = (0.5, 0.5, 1)

    # Enter edit mode to create the logo shape
    bpy.context.view_layer.objects.active = logo
    bpy.ops.object.mode_set(mode="EDIT")

    # Get the bmesh
    bm = bmesh.from_edit_mesh(logo.data)
    bmesh.ops.delete(bm, geom=bm.edges, context="EDGES")

    # Create Ethereum diamond shape vertices
    vertices = [
        (0, 0.3, 0),  # Top vertex
        (-0.2, 0.1, 0),  # Top left
        (-0.2, -0.1, 0),  # Bottom left
        (0, -0.3, 0),  # Bottom vertex
        (0.2, -0.1, 0),  # Bottom right
        (0.2, 0.1, 0),  # Top right
    ]

    # Create the diamond shape
    edges = [
        (0, 1),
        (1, 2),
        (2, 3),
        (3, 4),
        (4, 5),
        (5, 0),
        (1, 5),  # Top horizontal bar
        (1, 4),  # Middle horizontal bar
        (2, 5),  # Bottom horizontal bar
    ]

    # Clear existing geometry and create new
    bm.clear()
    for v in vertices:
        bm.verts.new(v)
    bm.verts.ensure_lookup_table()

    for e in edges:
        bm.edges.new((bm.verts[e[0]], bm.verts[e[1]]))

    # Create edges to faces
    bmesh.ops.contextual_create(bm, geom=bm.edges)

    # Update mesh
    bmesh.update_edit_mesh(logo.data)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Extrude the logo
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.02)})
    bpy.ops.object.mode_set(mode="OBJECT")

    # Create logo material (white/cream color)
    logo_mat = bpy.data.materials.new(name="LogoMaterial")
    logo_mat.use_nodes = True
    logo_mat.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.1
    logo_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.3
    logo_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (
        0.95,
        0.95,
        0.9,
        1,
    )
    logo.data.materials.append(logo_mat)

    # Add a bevel to the coin edge
    bpy.context.view_layer.objects.active = coin
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(coin.data)

    # Select top and bottom edges
    for edge in bm.edges:
        if edge.verts[0].co.z == 0.05 or edge.verts[1].co.z == 0.05:
            edge.select = True
        elif edge.verts[0].co.z == -0.05 or edge.verts[1].co.z == -0.05:
            edge.select = False

    # Bevel the edge
    bpy.ops.mesh.bevel(offset=0.02, segments=3)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Set up lighting
    bpy.ops.object.light_add(type="SUN", location=(5, 5, 10))
    sun = bpy.context.active_object
    sun.data.energy = 3

    # Add a second light for fill
    bpy.ops.object.light_add(type="AREA", location=(-3, -3, 5))
    area = bpy.context.active_object
    area.data.energy = 1.5
    area.data.size = 2

    # Set camera position
    bpy.ops.object.camera_add(location=(3, -3, 2))
    camera = bpy.context.active_object
    camera.rotation_euler = (1.1, 0, 0.785)

    # Set camera as active
    bpy.context.scene.camera = camera

    # Set render settings
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 128

    print("Ethereum coin created successfully!")


# Run the function
create_ethereum_coin()
