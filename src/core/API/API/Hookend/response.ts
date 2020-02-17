export default (req, res) => {
    res.json({
        success: true,
        data: req.requestResults,
    });
}
