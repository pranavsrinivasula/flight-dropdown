let isSearchEnabled = false;

const flowController = async (req, res) => {
  try {
    const { trigger } = req.body;

    // OptIn clicked → enable search/input fields
    if (trigger === "Enable_Search_Field") {
      isSearchEnabled = true;
      return res.json({
        data: {
          status: "active",
          is_search_enabled: true // this will show input and link
        }
      });
    }

    // Default response
    return res.json({
      data: {
        status: "active",
        is_search_enabled: isSearchEnabled
      }
    });

  } catch (err) {
    console.error("❌ flowController error:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { flowController };
