
/**
 * @class
 * @description Abstract base class for visualization views. Subclasses must implement the updateMap and updateOnClick methods, and define a legend array for the updateLegend method.
 */
export class VisualizationView
{
    /**
     * Create a visualization view.
     * @param {Object} vpuData - The data object containing all necessary information for the visualization view.
     * @param {Array} legend - An array of legend items with color and label properties. Child classes should create this in their constructor and pass it to the super constructor.
     */
    constructor(vpuData, legend)
    {
        this.vpuData = vpuData;
        this.legend = legend;   // Subclasses should define this as an array of legend items with color and label properties

        // Prevent direct instantiation of this abstract class
        if (this.constructor === VisualizationView)
        {
            throw new Error("Cannot instantiate abstract class VisualizationView directly.");
        }

        // Require subclasses to implement specific methods
        this.#requireMethod("updateMap");
        this.#requireMethod("getPopupOptions");
        this.#requireMethod("buildVpuPopup");
        this.#requireMethod("buildCatchmentPopup");
    }

    /**
     * Require a method to be implemented by subclasses.
     * @param {string} methodName The name of the method as a string to require child classes to implement
     */
    #requireMethod(methodName)
    {
        if (this[methodName] === undefined)
        {
            throw new Error(`Subclasses of VisualizationView must implement the ${methodName} method.`);
        }
    }

    /**
     * Update the legend based on the legend array defined in the subclass.
     */
    updateLegend()
    {
        // Require subclasses to define a legend array
        if (this.legend === undefined || !Array.isArray(this.legend))
        {
            throw new Error("Subclasses of VisualizationView must define a valid legend array.");
        }

        // Clear existing legend items
		const legendContainer = $('#legend-items');
		legendContainer.empty();
		
        // Add new legend items based on the legend array
		this.legend.forEach(item => {
			const legendItem = $(`
				<div class="legend-item" style="display: flex; align-items: center; margin-bottom: 8px;">
					<div class="legend-color" style="
						width: 20px; 
						height: 20px; 
						background-color: ${item.color}; 
						margin-right: 10px; 
						border: 1px solid #ccc;
						${item.pattern ? `background-image: ${item.pattern};` : ''}
					"></div>
					<span class="legend-label" style="font-size: 14px;">${item.label}</span>
				</div>
			`);
			legendContainer.append(legendItem);
		});
    }

    /**
     * Attaches the shared click handler used by every visualization view.
     *
     * The view is expected to provide three methods that customize the popup:
     *   - getPopupOptions()                       → options object for `new maplibregl.Popup(...)`
     *   - buildVpuPopup(feature, vpuData)         → HTML string for a VPU click
     *   - buildCatchmentPopup(feature, vpuData)   → HTML string for a catchment click
     *
     * @param {object} map  - The maplibre map object
     */
    updateOnClick(map)
    {
        map.on('click', (e) => {
            // Query all features at click point
            const allFeatures = map.queryRenderedFeatures(e.point);
            if (allFeatures.length === 0) return;

            console.log('All features at click point:', allFeatures);

            // Organize features by type
            const vpuFills = allFeatures.filter(f => f.layer.id.startsWith('vpu-fill-'));
            const catchmentFeatures = allFeatures.filter(f => f.layer.id.startsWith('catchments'));

            console.log('VPU fills (clicked inside):', vpuFills);
            console.log('Catchment features:', catchmentFeatures);

            // Pick the top-priority feature (Catchment wins over VPU)
            let selectedFeature = null;
            let featureType = 'unknown';

            if (catchmentFeatures.length > 0)
            {
                selectedFeature = catchmentFeatures[0];
                featureType = 'catchment';
            }
            else
            if (vpuFills.length > 0)
            {
                selectedFeature = vpuFills[0];
                featureType = 'vpu';
            }
            else
            {
                // Nothing clickable under the cursor — bail out before we touch null
                return;
            }

            // Debug info
            const topFeature = allFeatures[0];
            console.log(`Top layer: ${topFeature.layer.id}`);
            console.log('Feature properties:', topFeature.properties);

            // Look up this VPU's data and delegate popup construction to the view
            const vpuData = this.vpuData.vpus[selectedFeature.properties.vpuid];

            const popupContent = (featureType === 'vpu')
                ? this.buildVpuPopup(selectedFeature, vpuData)
                : this.buildCatchmentPopup(selectedFeature, vpuData);

            // Show popup with view-specific options
            new maplibregl.Popup(this.getPopupOptions())
                .setLngLat(e.lngLat)
                .setHTML(popupContent)
                .addTo(map);
        });
    }

    /**
     * Hook for when this view is selected in the UI. 
     * 
     * Default implementation does nothing, but views can override this to trigger one-time 
     * map updates that don't need to be re-applied on every pan/zoom (e.g. adding a new layer or setting up a unique click handler).
     * The main `updateMap` method is still called immediately after this, so it's safe to assume the map instance is fully initialized and ready for styling updates.
     * 
     * @param {maplibregl.Map} map - The MapLibre map instance.
     */
    async onSelect(map)
    {

    }

    /**
     * Re-paint the map for this view.
     *
     * Called whenever the view becomes active (see `mapSetVisualizationMode`) and
     * again from `map.on('idle')` for views that need re-application after pan/zoom
     * — MapLibre only renders currently-loaded tiles, so newly-streamed tiles need
     * a fresh styling pass.
     *
     * Typical implementation steps:
     *   - Iterate `this.vpuData` and update `fill-color` / `line-color` on each
     *     `vpu-fill-{id}` and `vpu-{id}` layer via `map.setPaintProperty()`.
     *   - Re-color catchments using helpers like `updateCatchmentColorComprehensive()`.
     *   - Re-order text labels with `map.moveLayer('vpu-labels')` so they stay on top.
     *
     * @abstract
     * @param {maplibregl.Map} map - The MapLibre map instance to paint.
     * @returns {void}
     * @throws {Error} If a subclass forgets to override this method.
     */
    updateMap(map)
    {
        throw new Error("Subclasses of VisualizationView must implement the updateMap method.");
    }

    /**
     * Options object passed to the MapLibre popup constructor for this view.
     *
     * The return value is forwarded verbatim to `new maplibregl.Popup(options)`
     * inside `updateOnClick`. Return `{}` for MapLibre defaults, or override
     * fields like `maxWidth` and `className` to widen the popup or hook in
     * custom CSS for table layouts.
     *
     * @abstract
     * @returns {Object} A MapLibre `PopupOptions` object.
     * @throws {Error} If a subclass forgets to override this method.
     *
     * @example
     * getPopupOptions()
     * {
     *     return { maxWidth: 'none', className: 'custom-popup' };
     * }
     */
    getPopupOptions()
    {
        throw new Error("Subclasses of VisualizationView must implement the getPopupOptions method.");
    }

    /**
     * Build the HTML body shown in the popup when a VPU fill is clicked.
     *
     * Invoked by the base-class `updateOnClick` after it has identified the
     * clicked feature and pre-resolved the matching `vpuData` entry. The returned
     * string is passed directly to `maplibregl.Popup.setHTML()`, so it must be a
     * self-contained markup snippet (no `<html>` / `<body>` wrappers).
     *
     * @abstract
     * @param {Object} feature - MapLibre rendered feature from `queryRenderedFeatures`.
     *                           `feature.properties.vpuid` holds the VPU identifier
     *                           (e.g. `'01'`, `'03N'`).
     * @param {Object} vpuData - This view's `this.vpuData[feature.properties.vpuid]`
     *                           entry, pre-resolved so subclasses don't repeat the
     *                           lookup. Shape is view-specific.
     * @returns {string} HTML markup for the popup body.
     * @throws {Error} If a subclass forgets to override this method.
     */
    buildVpuPopup(feature, vpuData)
    {
        throw new Error("Subclasses of VisualizationView must implement the buildVpuPopup method.");
    }

    /**
     * Build the HTML body shown in the popup when a catchment polygon is clicked.
     *
     * Same contract as `buildVpuPopup`, but invoked for catchment clicks. The
     * feature's `properties.divide_id` is of the form `'cat-12345'` and identifies
     * the specific catchment; `vpuData` is the *parent VPU's* record — catchments
     * are looked up indirectly via their containing VPU's id, not by `divide_id`.
     *
     * @abstract
     * @param {Object} feature - MapLibre rendered feature from `queryRenderedFeatures`.
     *                           `feature.properties.divide_id` holds the catchment id
     *                           (e.g. `'cat-4634'`); `feature.properties.vpuid` holds
     *                           the parent VPU id used to resolve `vpuData`.
     * @param {Object} vpuData - The parent VPU's record from `this.vpuData`,
     *                           pre-resolved. Shape is view-specific.
     * @returns {string} HTML markup for the popup body.
     * @throws {Error} If a subclass forgets to override this method.
     */
    buildCatchmentPopup(feature, vpuData)
    {
        throw new Error("Subclasses of VisualizationView must implement the buildCatchmentPopup method.");
    }

    /**
     * Unload the visualization view, cleaning up any resources or event listeners.
     * 
     * Child classes should override this method to perform any necessary cleanup.
     *
     * @param {maplibregl.Map} map - The MapLibre map instance
     */
    unload(map)
    {

    }
}
