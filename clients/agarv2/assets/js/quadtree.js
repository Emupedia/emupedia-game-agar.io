window.PointQuadTree = (function() {
	"use strict";

	var GROWTH = 1.1;

	class Node {
		constructor(x, y, w, h) {
			this.x = x;
			this.y = y;
			this.w = w;
			this.h = h;
			this.points = [];
			this.children = null;
		}
		containsPoint(point) {
			return point.x >= this.x && point.x <= this.x + this.w && point.y >= this.y && point.y <= this.y + this.h;
		}
		overlaps(aabb) {
			return aabb.x < this.x + this.w && aabb.x + aabb.w > this.x && aabb.y < this.y + this.h && aabb.y + aabb.h > this.y;
		}
		insert(point, maxPoints) {
			if (this.children != null) {
				const col = point.x > this.x + this.w / 2;
				const row = point.y > this.y + this.h / 2;

				this.children[col + row * 2].insert(point, maxPoints * GROWTH);
			} else {
				this.points.push(point);

				if (this.points.length > maxPoints && this.w > 1) {
					this.split(maxPoints);
				}
			}
		}
		some(aabb, test) {
			if (this.children != null) {
				for (let i = 0; i < this.children.length; ++i) {
					const child = this.children[i];
					if (child.overlaps(aabb) && child.some(aabb, test)) {
						return true;
					}
				}
			} else {
				for (let i = 0; i < this.points.length; ++i) {
					const point = this.points[i];

					if (Node.prototype.containsPoint.call(aabb, point) && test(point)) {
						return true;
					}
				}
			}

			return false;
		}
		split(maxPoints) {
			this.children = [];

			const halfW = this.w / 2;
			const halfH = this.h / 2;

			for (let y = 0; y < 2; ++y) {
				for (let x = 0; x < 2; ++x) {
					const px = this.x + x * halfW;
					const py = this.y + y * halfH;

					this.children.push(new Node(px, py, halfW, halfH));
				}
			}

			const oldPoints = this.points;

			this.points = [];

			const midX = this.x + halfW;
			const midY = this.y + halfH;

			for (var i = 0; i < oldPoints.length; ++i) {
				const point = oldPoints[i];
				const col = point.x > midX;
				const row = point.y > midY;

				this.children[col + row * 2].insert(point, maxPoints * GROWTH);
			}
		}
		clear() {
			if (this.children != null) {
				for (let i = 0; i < 4; ++i) {
					this.children[i].clear();
				}

				this.children.length = 0;
				this.children = null;
			}

			this.points.length = 0;
			this.points = null;
		}
	}

	class PointQuadTree {
		constructor(x, y, w, h, maxPoints) {
			this.root = new Node(x, y, w, h);
			this.maxPoints = maxPoints;
			this.parents = new Set();
		}
		clear() {
			this.root.clear();
			this.parents.clear();
		}
		insert(point) {
			if (!this.root.containsPoint(point)) return;

			if (point.parent) this.parents.add(point.parent);
			this.root.insert(point, this.maxPoints);
		}
		some(aabb, test) {
			// Jelly collision queries are centered on one outline point. Testing only the other
			// cells' sampled outline points misses overlaps when their samples do not line up, or
			// when the queried point is already inside a much larger cell. Use each unique parent
			// cell as a cheap circular broad phase before falling back to the exact point lookup.
			const x = aabb.x + aabb.w / 2;
			const y = aabb.y + aabb.h / 2;
			const padding = Math.max(aabb.w, aabb.h) / 2;

			for (const parent of this.parents) {
				if (!parent || !Number.isFinite(parent.x) || !Number.isFinite(parent.y) || !Number.isFinite(parent.s)) continue;

				const dx = x - parent.x;
				const dy = y - parent.y;
				const radius = Math.max(parent.s, 0) + padding;

				if (dx * dx + dy * dy <= radius * radius && test({ x, y, parent })) {
					return true;
				}
			}

			return this.root.some(aabb, test);
		}
	}

	return PointQuadTree;
})();
